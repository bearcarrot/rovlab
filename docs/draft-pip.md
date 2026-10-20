# Draft Assistant floating window (Document PiP)

## How it works
- `useDocumentPip` opens the window (`documentPictureInPicture.requestWindow`) from the click handler and keeps it in state only after the browser resolves. `pagehide` clears it.
- `DraftAssistant` renders `<DraftPip>` into that window with `createPortal`. It is the same React tree, so it reads and writes the same `useDraftSession` state as the page. There is no second copy and nothing to sync.
- Styles: `copyStyles` copies the `dark` class and every stylesheet into the PiP document. Cross-origin sheets (Google Fonts) are linked instead of copied.
- Closing the window (or leaving the page) never touches the draft; it lives in sessionStorage.

## Support
- Desktop Chromium 116+ (Chrome, Edge). Detected by feature, not by browser name.
- Firefox and Safari (desktop and iOS): API missing. The button is shown disabled with the reason on desktop-class pointers.
- Mobile: the button is hidden. A website cannot overlay RoV or any native game, and no mobile browser offers Document PiP.

## Not in v1
- Drag-to-swap, ban rows, role/lane filters, meters and gaps inside the window (the page keeps them).
- Possible later: system split-screen / floating-window modes on Android are an OS feature, not something the site can trigger.
