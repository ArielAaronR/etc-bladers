// Edit these to point at your real accounts.
import found from './data/events.json';

export type EtcEvent = { title: string; url: string; start: string; place: string };

export const site = {
  name: 'ETC Bladers',
  tagline: 'Beyblade crew · let it rip',
  eventsUrl: 'https://westcoastbladers.com/events',
  // ETC's upcoming events, soonest first, from src/data/events.json. `npm run find-event`
  // (and the GitHub Actions workflow, daily) fills it from WCB with:
  //   title, url (/events/view/<id>), start (Pacific time with offset), place (venue)
  // The first upcoming one is featured; with two or more, the rest are listed below.
  // An event drops off five hours after it starts. Edit the file to change it by hand;
  // [] shows "See upcoming events".
  events: found as EtcEvent[],
  socials: {
    instagram: 'https://www.instagram.com/etcbladers/',
    tiktok: 'https://www.tiktok.com/@etcbladers',
  },
};
