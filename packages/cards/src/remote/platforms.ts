/**
 * The streaming platforms the remote knows by name (1.18, #143): each with the colour its mark wears, the names a
 * player may list it under, and the Android package a TV launches it by. Their logos are in the `app-logos` chunk
 * (`app:<id>`), fetched the first time a card draws one; this table stays with the card so a source can be matched
 * before the logos land. A platform without a mark of its own in an open set wears Fluvy's monogram (`mono`).
 */
export interface Platform {
  readonly id: string;
  readonly title: string;
  /** The brand's colour (Simple Icons' data); empty where the open sets give none: the app wears the card's accent. */
  readonly hex: string;
  /** Other names a player lists it under, normalised (`normalise`). */
  readonly names?: readonly string[];
  /** The Android TV package (an Android TV Remote `activity`); known for the platforms that publish one. */
  readonly android?: string;
  /** A short name for a narrow cell ("Prime"), said where the title would not hold under its circle. */
  readonly short?: string;
}

/** A name as the match reads it: lower case, `+` as plus, letters and figures alone. */
export const normalise = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9]/g, '');

export const PLATFORMS: readonly Platform[] = [
  { id: 'netflix', title: 'Netflix', hex: '#E50914', android: 'com.netflix.ninja' },
  {
    id: 'disneyplus',
    title: 'Disney+',
    hex: '',
    names: ['disney'],
    android: 'com.disney.disneyplus',
  },
  {
    id: 'movistarplus',
    title: 'Movistar Plus+',
    hex: '#019DF4',
    names: ['movistar', 'movistarplusplus', 'movistartv'],
    short: 'Movistar+',
  },
  {
    id: 'primevideo',
    title: 'Prime Video',
    hex: '',
    names: ['amazonprimevideo', 'amazonprime', 'prime', 'amazonvideo'],
    android: 'com.amazon.amazonvideo.livingroom',
    short: 'Prime',
  },
  {
    id: 'appletv',
    title: 'Apple TV',
    hex: '#000000',
    names: ['appletvplus', 'appletvapp'],
    android: 'com.apple.atve.androidtv.appletv',
  },
  {
    id: 'rakutentv',
    title: 'Rakuten TV',
    hex: '#BF0000',
    names: ['rakuten', 'wuaki'],
    android: 'tv.rakuten.app',
    short: 'Rakuten',
  },
  { id: 'youtube', title: 'YouTube', hex: '#FF0000', android: 'com.google.android.youtube.tv' },
  {
    id: 'youtubemusic',
    title: 'YouTube Music',
    hex: '#FF0000',
    names: ['ytmusic'],
    android: 'com.google.android.youtube.tvmusic',
    short: 'YT Music',
  },
  {
    id: 'youtubetv',
    title: 'YouTube TV',
    hex: '#FF0000',
    android: 'com.google.android.youtube.tvunplugged',
    short: 'YT TV',
  },
  {
    id: 'youtubekids',
    title: 'YouTube Kids',
    hex: '#FF0000',
    android: 'com.google.android.youtube.tvkids',
    short: 'YT Kids',
  },
  {
    id: 'hbomax',
    title: 'HBO Max',
    hex: '#000000',
    names: ['hbo', 'hbogo', 'hbonow'],
    android: 'com.wbd.stream',
  },
  { id: 'max', title: 'Max', hex: '#525252' },
  { id: 'hulu', title: 'Hulu', hex: '', android: 'com.hulu.livingroomplus' },
  {
    id: 'paramountplus',
    title: 'Paramount+',
    hex: '#0064FF',
    names: ['paramount', 'cbsallaccess'],
    android: 'com.cbs.ott',
    short: 'Paramount',
  },
  {
    id: 'peacock',
    title: 'Peacock',
    hex: '',
    names: ['peacocktv'],
    android: 'com.peacocktv.peacockandroid',
  },
  { id: 'dazn', title: 'DAZN', hex: '#F8F8F5', android: 'com.dazn' },
  { id: 'filmin', title: 'Filmin', hex: '' },
  { id: 'skyshowtime', title: 'SkyShowtime', hex: '', short: 'Sky' },
  {
    id: 'crunchyroll',
    title: 'Crunchyroll',
    hex: '#FF5E00',
    android: 'com.crunchyroll.crunchyroid',
  },
  { id: 'plutotv', title: 'Pluto TV', hex: '', names: ['pluto'], android: 'tv.pluto.android' },
  { id: 'tubi', title: 'Tubi', hex: '#7408FF', names: ['tubitv'], android: 'com.tubitv' },
  { id: 'twitch', title: 'Twitch', hex: '#9146FF', android: 'tv.twitch.android.app' },
  { id: 'plex', title: 'Plex', hex: '#EBAF00', android: 'com.plexapp.android' },
  { id: 'jellyfin', title: 'Jellyfin', hex: '#00A4DC', android: 'org.jellyfin.androidtv' },
  { id: 'emby', title: 'Emby', hex: '#52B54B', android: 'tv.emby.embyatv' },
  { id: 'kodi', title: 'Kodi', hex: '#17B2E7', android: 'org.xbmc.kodi' },
  { id: 'spotify', title: 'Spotify', hex: '#1ED760', android: 'com.spotify.tv.android' },
  {
    id: 'applemusic',
    title: 'Apple Music',
    hex: '#FA243C',
    android: 'com.apple.android.music',
    short: 'Music',
  },
  { id: 'applepodcasts', title: 'Apple Podcasts', hex: '#9933CC', short: 'Podcasts' },
  {
    id: 'amazonmusic',
    title: 'Amazon Music',
    hex: '',
    android: 'com.amazon.bueller.music',
    short: 'Amazon',
  },
  { id: 'deezer', title: 'Deezer', hex: '#A238FF', android: 'deezer.android.tv' },
  { id: 'tidal', title: 'TIDAL', hex: '#000000', android: 'com.aspiro.tidal' },
  { id: 'soundcloud', title: 'SoundCloud', hex: '#FF5500' },
  { id: 'audible', title: 'Audible', hex: '#F8991C' },
  { id: 'pocketcasts', title: 'Pocket Casts', hex: '#F43E37', short: 'Pocket' },
  {
    id: 'steam',
    title: 'Steam',
    hex: '#000000',
    names: ['steamlink'],
    android: 'com.valvesoftware.steamlink',
  },
  { id: 'xbox', title: 'Xbox', hex: '', names: ['xboxone', 'xboxseriesx', 'xboxseriess'] },
  {
    id: 'playstation',
    title: 'PlayStation',
    hex: '#0070D1',
    names: ['ps5', 'ps4', 'playstation5', 'playstation4'],
  },
  {
    id: 'nintendoswitch',
    title: 'Nintendo Switch',
    hex: '',
    names: ['switch', 'nintendo'],
    short: 'Switch',
  },
  { id: 'atresplayer', title: 'ATRESplayer', hex: '', names: ['atresmedia'], short: 'Atres' },
  { id: 'rtveplay', title: 'RTVE Play', hex: '', names: ['rtve'] },
  { id: 'mitele', title: 'Mitele', hex: '', names: ['miteleplus', 'mediaset'] },
  { id: 'mubi', title: 'MUBI', hex: '#000000', android: 'com.mubi' },
  { id: 'vimeo', title: 'Vimeo', hex: '#1AB7EA' },
  { id: 'dailymotion', title: 'Dailymotion', hex: '#0A0A0A' },
  { id: 'viaplay', title: 'Viaplay', hex: '#FE365F' },
  { id: 'googletv', title: 'Google TV', hex: '#4285F4', names: ['googleplaymoviestv'] },
  { id: 'googleplay', title: 'Google Play', hex: '#414141', names: ['playstore'], short: 'Play' },
  { id: 'channel4', title: 'Channel 4', hex: '#AAFF89', names: ['all4'] },
  { id: 'itvx', title: 'ITVx', hex: '#DEEB52', names: ['itvhub', 'itv'] },
  { id: 'zdf', title: 'ZDF', hex: '#FA7D19', names: ['zdfmediathek'] },
  { id: 'starz', title: 'STARZ', hex: '#082125' },
  { id: 'showtime', title: 'Showtime', hex: '#B10000' },
  { id: 'now', title: 'NOW', hex: '#001211', names: ['nowtv'] },
  { id: 'nebula', title: 'Nebula', hex: '#2CADFE' },
  { id: 'fubo', title: 'Fubo', hex: '#C83D1E', names: ['fubotv'] },
  { id: 'tiktok', title: 'TikTok', hex: '#000000' },
  { id: 'roku', title: 'Roku', hex: '#662D91', names: ['rokuchannel', 'therokuchannel'] },
  { id: 'bilibili', title: 'Bilibili', hex: '#00A1D6' },
];

/** The platforms whose mark is Fluvy's monogram: no open set has their logo. */
export const MONOGRAMS: Readonly<Record<string, string>> = {
  disneyplus: 'D+',
  primevideo: 'PV',
  peacock: 'Pk',
  filmin: 'Fm',
  skyshowtime: 'SS',
  plutotv: 'Pl',
  amazonmusic: 'AM',
  atresplayer: 'AP',
  rtveplay: 'RP',
  mitele: 'Mt',
};

const byId = new Map(PLATFORMS.map((p) => [p.id, p]));
/** Every name a platform answers to, normalised, each to its platform: its id, its title, its other names, its package. */
const byName = new Map<string, Platform>();
for (const p of PLATFORMS) {
  for (const name of [p.id, p.title, ...(p.names ?? [])]) byName.set(normalise(name), p);
  if (p.android) byName.set(p.android.toLowerCase(), p);
}

/** A platform by its id. */
export const platform = (id: string | undefined): Platform | undefined =>
  id ? byId.get(id) : undefined;

/**
 * The platform a name stands for — a player's source ("Netflix", "DISNEY+", "prime video"), an app's name, an Android
 * package — whatever its case and spacing; none for a name no platform answers to (a tuner's "TV", "HDMI 1").
 */
export function platformOf(name: string | undefined): Platform | undefined {
  if (!name) return undefined;
  return byName.get(name.toLowerCase()) ?? byName.get(normalise(name));
}

/** What of an app of the row names it. */
export type AppSaid = Readonly<{ app?: string; name?: string; source?: string }>;

/** The platform an app of the row stands for: by its id, else by what it is called. */
export const appPlatform = (app: AppSaid): Platform | undefined =>
  platform(app.app) ?? platformOf(app.app) ?? platformOf(app.source) ?? platformOf(app.name);

/** What an app is called in full: the person's name, else its platform's title, else its source. */
export const appTitle = (app: AppSaid, pf = appPlatform(app)): string =>
  app.name ?? pf?.title ?? app.source ?? '';

/** A title as the row says it under the circle: a platform's own in its short form, a person's as it is. */
export const shortTitle = (title: string, pf: Platform | undefined): string =>
  pf && title === pf.title ? (pf.short ?? title) : title;

/** What the row says under an app. */
export const appSaid = (app: AppSaid): string => shortTitle(appTitle(app), appPlatform(app));
