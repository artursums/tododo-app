# tododo custom artwork — 2026-09-12

The icon family is original repo-native SVG, rendered with the already installed
`react-native-svg`. No Apple emoji or SF Symbols are used for calendar artwork.
Legacy emoji strings remain only as stable stored identifiers, so existing
calendars keep the intended type after upgrading.

- `src/components/TododoIcon.tsx`: compact navigation, settings and editor
  drawings; open corners, offset dots, translucent panels; focused tab scale
  springs and coral accent dots.
- `src/components/calendar/CalendarIllustration.tsx`: miniature scenes for
  family, personal plans, relationships, work, friends, shifts, lessons, school,
  hobbies, travel and exercise. Palette: indigo, coral, lilac and warm paper.
- `src/components/calendar/CalendarArtwork.tsx`: maps existing calendar types
  to illustrations and keeps the user's photo cover when one exists.
- `assets/illustrations/together.png`: generated illustration used on People.
  Original remains at
  `/Users/a88/.codex/generated_images/01a094a2-a3d0-7c32-b089-b81f0c1ba976/exec-b5c4fa6e-7e69-4a77-bf5d-050bc5babecf.png`.

The small interactive icons are vectors for crisp rendering at every size; the
larger People illustration is the generated raster asset. Calendar type rows
react to presses, the selected icon is announced to accessibility services,
and the existing tab transition now uses the custom drawings.

Image generation prompt:

> Use case: stylized-concept. Asset type: original family-calendar cover illustration for the mobile app tododo, usable as a small landscape icon tile. Create a single premium minimalist illustration of three abstract people gathered inside one open, softly rounded indigo house outline; two taller figures and a shorter one. Completely original geometry, no Apple emoji, no SF Symbols, no TimeTree characters. Refined flat dimensional paper-cut design with restrained subtle shadows, generous negative space, rounded asymmetrical silhouettes, faces omitted. Palette: indigo #6256C7, pale lilac #EEEAFB, warm coral #FB7185, cream #F8F7F4. The artwork should be bold and legible at 76 by 56 pixels. Landscape 4:3 composition. No text, no letters, no logos, no watermark. Solid pale lilac background, art centered with generous 15 percent inset.

Validation: TypeScript and ESLint passed. 56 Jest tests passed; 34 assertions
against actual PostgreSQL migrations passed. Native visual checks on iPhone 17
Pro / Expo Go covered calendar templates, Settings light and dark, default view
selection applied to Calendar, default reminder selection applied to a new plan,
People without a connected backend, and the pasted-invitation screen. Settings
were restored to light, Month, 10-minute reminder; no test plan was saved.

Sharing connection requirements and limits are in `SHARING-SETUP.md`. Cloud
invitation delivery and real two-device collaboration remain unverified until
the user's Supabase project is created and connected.
