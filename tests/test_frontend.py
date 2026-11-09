"""The compressed sidecars beside Fluvy's build stay true to their files (#134).

Run in Home Assistant's image, as CI does, from the repository's root:

    docker run --rm -v "$PWD/custom_components:/config/custom_components:ro" \
      -v "$PWD/tests:/config/tests:ro" -w /config ghcr.io/home-assistant/home-assistant:stable \
      python3 -m unittest discover -s tests -v
"""

# SPDX-License-Identifier: GPL-3.0-only

from __future__ import annotations

import gzip
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest import mock

import brotli

from custom_components.fluvy import frontend
from custom_components.fluvy.frontend import PROVED, sweep_sidecars

# a script over 1 KB, and another of the same size: a change a size cannot tell
OLD = b"export const words = '" + b"fluvy " * 400 + b"';\n"
NEW = OLD.replace(b"fluvy", b"FLUVY")


class SidecarsTest(unittest.TestCase):
    """What `sweep_sidecars` keeps, makes and deletes."""

    def setUp(self) -> None:
        """Make an empty build folder."""
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.build = Path(folder.name) / "frontend"
        self.record = self.build.parent / PROVED
        (self.build / "chunks").mkdir(parents=True)
        self.script = self.build / "chunks" / "core-abcdefgh.js"

    def sidecars(self, path: Path) -> tuple[bytes, bytes]:
        """Return what a file's `.br` and `.gz` unpack to."""
        br = path.with_name(path.name + ".br").read_bytes()
        gz = path.with_name(path.name + ".gz").read_bytes()
        return brotli.decompress(br), gzip.decompress(gz)

    def settled(self):
        """Count every file as changed long ago (a start a while after a deploy)."""
        return mock.patch.object(frontend, "SETTLED_NS", -10_000_000_000)

    def test_a_file_without_sidecars_gets_both(self) -> None:
        """A text file over 1 KB is sent compressed; a smaller one or a font is not."""
        self.script.write_bytes(OLD)
        (self.build / "fluvy.js").write_bytes(b"import './chunks/core-abcdefgh.js';\n")
        (self.build / "inter.woff2").write_bytes(OLD)
        self.assertEqual(sweep_sidecars(self.build), 2)
        self.assertEqual(self.sidecars(self.script), (OLD, OLD))
        self.assertEqual(
            sorted(p.name for p in self.build.iterdir() if p.suffix in (".br", ".gz")), []
        )

    def test_a_file_changed_after_its_sidecars_is_never_served_stale(self) -> None:
        """A deploy that copies a new file over an old one: its old sidecars are made again."""
        self.script.write_bytes(OLD)
        sweep_sidecars(self.build)
        self.script.write_bytes(NEW)  # the same size, at once
        self.assertEqual(sweep_sidecars(self.build), 2)
        self.assertEqual(self.sidecars(self.script), (NEW, NEW))

    def test_a_file_changed_after_it_was_proved_and_recorded_is_proved_again(self) -> None:
        """A start finds a file of the same size changed since the record: its times tell it."""
        self.script.write_bytes(OLD)
        with self.settled():
            sweep_sidecars(self.build)
            sweep_sidecars(self.build)  # proved and recorded
            self.assertIn("chunks/core-abcdefgh.js", json.loads(self.record.read_text()))
            time.sleep(0.05)  # a later moment, past the clock's step
            self.script.write_bytes(NEW)
            self.assertEqual(sweep_sidecars(self.build), 2)
        self.assertEqual(self.sidecars(self.script), (NEW, NEW))

    def test_a_start_with_everything_as_recorded_reads_no_file(self) -> None:
        """Most starts: every file stands as recorded, nothing is unpacked, made or written."""
        self.script.write_bytes(OLD)
        with self.settled():
            sweep_sidecars(self.build)
            sweep_sidecars(self.build)
            recorded = self.record.stat().st_mtime_ns
            with mock.patch.object(frontend, "_remake_sidecars") as remake:
                self.assertEqual(sweep_sidecars(self.build), 0)
            remake.assert_not_called()
        self.assertEqual(self.record.stat().st_mtime_ns, recorded)
        # the record is kept beside the folder Home Assistant serves, never in it
        self.assertFalse(any(p.name == PROVED for p in self.build.rglob("*")))

    def test_a_copied_sidecar_is_proved_whatever_its_times_say(self) -> None:
        """An old sidecar copied back with its times kept (`cp -p`) is not taken on its word."""
        self.script.write_bytes(OLD)
        with self.settled():
            sweep_sidecars(self.build)
            sweep_sidecars(self.build)
            gz = self.script.with_name(self.script.name + ".gz")
            stat = gz.stat()
            time.sleep(0.05)
            gz.write_bytes(gzip.compress(NEW))
            os.utime(gz, ns=(stat.st_atime_ns, stat.st_mtime_ns))
            self.assertEqual(sweep_sidecars(self.build), 1)
        self.assertEqual(self.sidecars(self.script), (OLD, OLD))

    def test_a_sidecar_that_does_not_unpack_is_made_again(self) -> None:
        """A sidecar cut short, or not one at all."""
        self.script.write_bytes(OLD)
        self.script.with_name(self.script.name + ".gz").write_bytes(gzip.compress(OLD)[:40])
        self.script.with_name(self.script.name + ".br").write_bytes(b"not brotli")
        self.assertEqual(sweep_sidecars(self.build), 2)
        self.assertEqual(self.sidecars(self.script), (OLD, OLD))

    def test_a_sidecar_without_its_file_goes(self) -> None:
        """A file gone, or one the build does not compress: its sidecars are deleted."""
        orphan = self.build / "chunks" / "gone-12345678.js.gz"
        orphan.write_bytes(gzip.compress(OLD))
        (self.build / "inter.woff2").write_bytes(OLD)
        (self.build / "inter.woff2.br").write_bytes(brotli.compress(OLD))
        self.assertEqual(sweep_sidecars(self.build), 2)
        self.assertEqual(sorted(p.name for p in self.build.rglob("*")), ["chunks", "inter.woff2"])

    def test_a_sidecar_that_cannot_be_made_leaves_setup_going_and_is_tried_again(self) -> None:
        """A read-only folder: nothing raises, the file is logged and not taken as proved."""
        self.script.write_bytes(OLD)
        real = Path.write_bytes

        def refused(path: Path, data: bytes) -> int:
            if path.name.endswith(".gz"):
                raise PermissionError("read-only")
            return real(path, data)

        with (
            self.settled(),
            self.assertLogs(frontend._LOGGER, "WARNING") as logs,
            mock.patch.object(Path, "write_bytes", refused),
        ):
            self.assertEqual(sweep_sidecars(self.build), 0)
        self.assertIn("chunks/core-abcdefgh.js", logs.output[0])
        self.assertNotIn("chunks/core-abcdefgh.js", json.loads(self.record.read_text()))
        # writable again, the next start makes what the last could not
        with self.settled():
            self.assertEqual(sweep_sidecars(self.build), 1)
        self.assertEqual(self.sidecars(self.script), (OLD, OLD))

    def test_a_file_gone_in_the_middle_of_the_walk_does_not_stop_the_rest(self) -> None:
        """A file that vanishes between the walk and its turn: the others are still kept."""
        self.script.write_bytes(OLD)
        other = self.build / "chunks" / "gone-12345678.js"
        other.write_bytes(NEW)
        real = frontend._remake_sidecars

        def vanishing(source: Path) -> int:
            if source == other:
                other.unlink()
            return real(source)

        with (
            mock.patch.object(frontend, "_remake_sidecars", vanishing),
            self.assertLogs(frontend._LOGGER, "WARNING"),
        ):
            self.assertEqual(sweep_sidecars(self.build), 2)
        self.assertEqual(self.sidecars(self.script), (OLD, OLD))

    def test_a_file_gone_between_its_listing_and_its_stat_has_no_mark(self) -> None:
        """The walk itself: a path it found that is gone when it is read."""
        self.script.write_bytes(OLD)
        real = Path.stat

        def stat(path: Path, *args, **kwargs) -> os.stat_result:
            if path == self.script:
                raise FileNotFoundError(path)
            return real(path, *args, **kwargs)

        with mock.patch.object(Path, "stat", stat):
            self.assertEqual(frontend._marks(self.build), {})

    def test_without_brotli_a_br_that_cannot_be_proved_goes(self) -> None:
        """Brotli not importable: the `.gz` is made, a `.br` is deleted, never taken on trust."""
        self.script.write_bytes(OLD)
        br = self.script.with_name(self.script.name + ".br")
        br.write_bytes(brotli.compress(OLD))
        with mock.patch.dict(frontend.CODECS, clear=True, values={".gz": frontend.CODECS[".gz"]}):
            self.assertEqual(sweep_sidecars(self.build), 2)
        self.assertFalse(br.exists())
        self.assertEqual(
            gzip.decompress(self.script.with_name(self.script.name + ".gz").read_bytes()), OLD
        )


if __name__ == "__main__":
    unittest.main()
