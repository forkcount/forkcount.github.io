# Caloriq Manual Release Test Checklist

Run through every item below before each production release.

## 1. Core Functional Flows
- [ ] **Signup**: Open Sign Up modal, verify age gate ("Are you 13 or older?"), verify honeypot field is hidden, enter valid email & password (minimum Fair strength), verify 6-digit email code, complete the 8 physiology onboarding questions, and confirm daily calorie & macro targets are calculated.
- [ ] **Signin**: Sign out, open Log In modal, verify "Last signed in" timestamp displays when available, test email/password sign-in and Google sign-in alternative, and verify session appears in the Me tab session list.
- [ ] **Log Food (Manual, Saved, Packaged)**: Add a food item to Breakfast, Lunch, Dinner, and Snacks. Verify calorie ring and macro progress bars update immediately and announce via `aria-live`.
- [ ] **AI Log**: Open Add Food -> Smart AI tab (verifying the AI bundle loads on demand). Test `"60g dried prunes, oatmeal 150g, milk 200g"` (~282 kcal total). Verify meal-specific protein advice and health rating.
- [ ] **Water**: Tap water glasses in the Diary tab to increment/decrement daily hydration. Verify screen reader text alternative and offline persistence.
- [ ] **Weight**: Log a new weight entry in the Me tab (testing 20–500 kg bounds), verify trend chart updates, and test deleting an entry.
- [ ] **Reports**: Open the Reports tab, verify weekly calorie/macro charts, outlier filtering (>20,000 kcal days excluded), and clean print layout (`Cmd/Ctrl + P`).
- [ ] **Data Export & Restore**: Click "Export data as JSON" in the Me tab, then test "Restore from backup" with the downloaded JSON file (including version migration check).
- [ ] **Delete Account**: In the Me tab, click "Delete account?", enter current password when prompted, confirm permanent deletion, and verify all account data, sessions, and local storage are wiped.

## 2. Cross-Browser & Device Verification Matrix
- [ ] **iPhone Safari (iOS)**: Verify 44x44 px minimum tap targets, `apple-touch-icon`, standalone home-screen mode, and safe-area bottom navigation padding.
- [ ] **Android Chrome**: Verify Web App Manifest, service worker offline caching for diary/water/exercise, and custom "Install Caloriq" prompt after 3 distinct logged days.
- [ ] **Desktop Chrome**: Verify keyboard Tab navigation, visible focus outlines, Skip-to-content link, Escape/outside-click modal dismissal, and Lighthouse scores 90+ across Performance, Accessibility, Best Practices, and SEO.
- [ ] **Desktop Firefox**: Verify layout rendering, SVG calorie ring & charts, and print stylesheet formatting.
- [ ] **Desktop Safari (macOS)**: Verify font preloading (`font-display: swap`), WebP/SVG rendering, and `prefers-reduced-motion` compliance.
