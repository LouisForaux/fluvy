"""Serve the build and put it on every page: the static path, the module, the settings panel."""

# SPDX-License-Identifier: GPL-3.0-only

from __future__ import annotations

from collections.abc import Callable
import contextlib
import gzip
import json
import logging
import os
from pathlib import Path
import time

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant, callback

from .const import PANEL_ELEMENT, PANEL_ICON, PANEL_TITLE, PANEL_URL_PATH, FluvyRuntime

try:
    import brotli
except ImportError:  # Home Assistant's image has it; without it the `.gz` sidecars travel alone
    brotli = None

_LOGGER = logging.getLogger(__name__)

# What a build cannot do without.
REQUIRED_FILES = ("fluvy.js", "loader.js")

# What a browser that accepts it is sent in a file's place (aiohttp's static handler serves
# `name.br` or `name.gz` beside `name`): the build's text files over 1 KB, which
# `packages/bundle/scripts/sidecars.mjs` packs at the best levels. One made again here is packed at
# gzip's best and brotli's 8: its 11 would hold a Raspberry Pi's start for half a minute where every
# sidecar is to be made, for 7 % fewer bytes.
COMPRESSED = (".js", ".css", ".json", ".svg")
COMPRESSED_OVER = 1024
SIDECARS = (".br", ".gz")
# What was proved true (`sweep_sidecars`): each file's mark as it stood then, beside the build's
# folder and never in it (what is in it is served to anyone who asks).
PROVED = ".sidecars"
# How long a file's times may lag a change to it: a file changed more lately is proved again.
SETTLED_NS = 2_000_000_000
CODECS: dict[str, tuple[Callable[[bytes], bytes], Callable[[bytes], bytes]]] = {
    ".gz": (lambda data: gzip.compress(data, compresslevel=9, mtime=0), gzip.decompress),
}
if brotli is not None:
    CODECS[".br"] = (
        lambda data: brotli.compress(data, mode=brotli.MODE_TEXT, quality=8),
        brotli.decompress,
    )


def read_build(frontend_dir: Path) -> tuple[str, str] | None:
    """Return the build's version and stamp from its manifest, or None without a build to serve.

    Runs in the executor.
    """
    try:
        data = json.loads((frontend_dir / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    version, build = data.get("version"), data.get("build")
    if not isinstance(version, str) or not isinstance(build, str):
        return None
    if not all((frontend_dir / name).is_file() for name in REQUIRED_FILES):
        return None
    return version, build


def _travels_compressed(name: str, size: int) -> bool:
    """Return whether a file of the build travels compressed: text over 1 KB, as the build says."""
    return name.endswith(COMPRESSED) and size > COMPRESSED_OVER


def _holds(sidecar: Path, unpack: Callable[[bytes], bytes], data: bytes) -> bool:
    """Return whether a sidecar unpacks to exactly its file's bytes."""
    try:
        return unpack(sidecar.read_bytes()) == data
    except Exception:  # what does not unpack (cut short, not one at all) does not hold
        return False


def _marks(frontend_dir: Path) -> dict[str, list[int]]:
    """Return how the build's files stand, by their path in it.

    A file's mark is its size and its times, the change time among them: the one no copy keeps.
    """
    marks: dict[str, list[int]] = {}
    for path in frontend_dir.rglob("*"):
        try:
            if path.is_file():
                stat = path.stat()
                marks[path.relative_to(frontend_dir).as_posix()] = [
                    stat.st_size,
                    stat.st_mtime_ns,
                    stat.st_ctime_ns,
                ]
        except OSError as err:  # gone in the middle of the walk: it has no mark
            _LOGGER.debug("Could not read %s: %s", path, err)
    return marks


def _proved(name: str, files: dict[str, list[int]], proved: dict[str, list[int]]) -> bool:
    """Return whether a file and its sidecars stand as they stood when they were proved true."""
    for suffix in ("", *SIDECARS):
        mark = files.get(name + suffix)
        if mark is None:
            # a sidecar it lacks is owed where it can be made here
            if suffix in CODECS:
                return False
        elif proved.get(name + suffix) != mark:
            return False
    return True


def _remake_sidecars(source: Path) -> int:
    """Prove a file's sidecars true or make them again; return how many were made or deleted."""
    data = source.read_bytes()
    count = 0
    for suffix in SIDECARS:
        sidecar = source.with_name(source.name + suffix)
        codec = CODECS.get(suffix)
        if codec is None:
            # no brotli here: a `.br` that cannot be proved is deleted, never served
            if sidecar.is_file():
                sidecar.unlink()
                count += 1
        elif not _holds(sidecar, codec[1], data):
            sidecar.write_bytes(codec[0](data))
            count += 1
    return count


def sweep_sidecars(frontend_dir: Path) -> int:
    """Keep the compressed sidecars true to their files: aiohttp serves one in a file's place.

    Every text file over 1 KB travels with a `.br` and a `.gz` (the build ships both). What was
    proved true is recorded beside the folder (`.sidecars`: each file's size and times), so a start
    that finds every file as recorded only reads the folder. Any other sidecar is unpacked and
    compared with its file, and made again where it does not hold (a `.br` is deleted instead where
    brotli is not importable); a sidecar without its file goes. Returns how many were made or
    deleted.

    Runs in the executor.
    """
    record = frontend_dir.parent / PROVED
    try:
        proved = json.loads(record.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        proved = {}
    if not isinstance(proved, dict):
        proved = {}
    files = _marks(frontend_dir)
    count = 0
    failed: set[str] = set()
    for name, mark in files.items():
        source, suffix = os.path.splitext(name)
        try:
            if suffix in SIDECARS:
                if source not in files or not _travels_compressed(source, files[source][0]):
                    (frontend_dir / name).unlink()
                    count += 1
            elif _travels_compressed(name, mark[0]) and not _proved(name, files, proved):
                count += _remake_sidecars(frontend_dir / name)
        except OSError as err:  # a read-only folder, a file gone in the middle of the walk
            _LOGGER.warning("Could not keep the compressed copies of %s: %s", name, err)
            failed.add(name)
    # recorded as they stand now, but a file changed in the last moments: a change that quick could
    # leave its times as they were (a coarse clock, a FAT card's two seconds), so it waits its turn;
    # one that could not be kept true is never recorded, so it is tried again at the next start
    settled = time.time_ns() - SETTLED_NS
    now = {
        name: mark
        for name, mark in _marks(frontend_dir).items()
        if mark[2] < settled and name not in failed
    }
    if now != proved:
        with contextlib.suppress(OSError):  # unrecorded, it is all proved again at the next start
            record.write_text(json.dumps(now), encoding="utf-8")
    return count


async def async_register_static(hass: HomeAssistant, runtime: FluvyRuntime) -> None:
    """Serve the build's folder under its own URL, cacheable for good (the URL changes with it)."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(runtime.url_base, str(runtime.frontend_dir), cache_headers=True)]
    )


@callback
def async_add_module(hass: HomeAssistant, runtime: FluvyRuntime) -> None:
    """Load the loader on every page (the next page load picks it up; no restart)."""
    frontend.add_extra_js_url(hass, runtime.loader_url)


@callback
def async_remove_module(hass: HomeAssistant, runtime: FluvyRuntime) -> None:
    """Stop loading the loader on every page."""
    frontend.remove_extra_js_url(hass, runtime.loader_url)


async def async_register_settings_panel(hass: HomeAssistant, runtime: FluvyRuntime) -> None:
    """Put Fluvy's settings in the sidebar, replacing a panel of the same path (YAML, a reload)."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=runtime.loader_url,
        require_admin=False,
    )


@callback
def async_remove_settings_panel(hass: HomeAssistant) -> None:
    """Take Fluvy's settings out of the sidebar."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
