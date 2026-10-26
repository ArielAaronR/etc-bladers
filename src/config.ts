// Edit these to point at your real accounts.
import found from './data/event.json';

export type FeaturedEvent = { title: string; url: string; start: string; place: string };

export const site = {
  name: 'ETC Bladers',
  tagline: 'Beyblade crew · let it rip',
  eventsUrl: 'https://westcoastbladers.com/events',
  // The event to feature comes from src/data/event.json, which `npm run find-event`
  // (and the GitHub Actions workflow, daily) fills with ETC's next event on WCB:
  //   title, url (/events/view/<id>), start (Pacific time with offset), place (venue)
  // To feature something by hand, edit that file; null shows "See upcoming events".
  // Once start + 5 hours has passed, the page switches to "See upcoming events" by itself.
  nextEvent: found as FeaturedEvent | null,
  socials: {
    instagram: 'https://www.instagram.com/etcbladers/',
    tiktok: 'https://www.tiktok.com/@etcbladers',
  },
};
