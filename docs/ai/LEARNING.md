# Learning first

I'm a frontend web engineer. This take-home needed two things I hadn't shipped before: a React Native app and a backend. I didn't want AI to fill those gaps for me. I wanted to understand every part well enough to review it, change it and defend it in a code review. So I learned first, and I used AI as a tutor while I did.

## How I learned

1. **Foundations from video courses.** I started with React Native and NestJS courses to get the mental model: how a native app renders, how navigation and lists differ from the web, and how a NestJS app is put together from modules, providers and guards.
2. **AI as a tutor for the gaps.** Then I used AI to go deeper where the courses stopped, always in the context of this project:
   - **Explain it through what I know.** "How is this different from how I'd do it in React on the web, and what breaks if I do it the web way?"
   - **Ask why until it's clear.** Why FlashList over FlatList, why SecureStore over AsyncStorage for tokens, why a guard and not a middleware.
   - **Compare options with trade-offs** before picking one, instead of taking the first suggestion.
   - **Check my understanding.** I explained a concept back and asked to be corrected, or asked for edge cases I hadn't thought of.
3. **Build that part right after learning it,** with a plan I could now judge.
4. **Review the result against what I learned,** and go back with more questions when something didn't match.

The same approach covered the surrounding topics: monorepo and TypeScript engineering, testing React Native with Jest and Testing Library, and the investing domain (orders, buying power, market hours, how a real broker handles accounts).

## Decisions it shaped

### React Native

| Topic                 | Decision in the repo                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Expo Go               | The app runs in Expo Go, so only libraries bundled with it are used: no custom native code, no MMKV.            |
| Lists and performance | Long lists use FlashList, and a live price tick re-renders only the row that changed.                           |
| Animations            | Reanimated for price flashes and gestures, running off the JS thread.                                           |
| App lifecycle         | The socket pauses only when the app goes to the background (AppState), not on every screen blur.                |
| Storage and security  | Tokens and the device identity live in SecureStore; only an allow-list of queries is persisted to AsyncStorage. |

### Backend

| Topic          | Decision in the repo                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NestJS modules | The server is split by feature (market, trading, watchlist, auth, customers, admin), each with thin controllers and services that own one concern.                                  |
| Guards         | A default-deny customer guard with explicit public routes, an optional-customer mode for guest-friendly routes such as the watchlist, and a writable guard for maintenance.         |
| Prisma         | Prisma with SQLite: a real database with migrations and a seed, instead of mocks.                                                                                                   |
| Transactions   | Multi-step changes (claiming a guest account at sign-up, merging guest stars at sign-in) run in one transaction; list endpoints use batched reads instead of a transaction per row. |

Learning also changed decisions along the way. Early on, the plan assumed Vitest. Once I understood how jest-expo and React Native Testing Library fit the mobile app, I chose Jest everywhere, so the whole repo has one test runner.

## Why this matters for the workflow

Learning first is what made the rest of the workflow safe. Because I understood the platform, I could write precise briefs, spot a wrong plan, and judge a reviewer's finding. Without that, "the human owns the decisions" would only be a formality.
