# Zeros to Heroes - Tryptych Dice Roller

A beautiful, interactive dice roller for the Zeros to Heroes TTRPG system with premium monetization features for itch.io.

## Features

### Free Version
- 🎲 **Tryptych Dice System** - Roll with three axes (Stat, Context, Symbolic)
- 📊 **Live Probability Calculator** - See your chances before you roll
- 💾 **Roll History** - Track your last 50 rolls
- 🎯 **Character Presets** - Save and load modifier configurations
- 📁 **Export Options** - Export rolls to JSON and CSV

### Premium Version
- ✨ **Advanced Analytics** - Detailed statistics and outcome distributions
- 📈 **Unlimited History** - Never lose a roll
- 📝 **Markdown Export** - Beautiful formatted roll reports
- 🔄 **Import/Export Presets** - Share preset collections
- 🎨 **Custom Themes** (coming soon)

## Monetization Setup on Itch.io

### Option 1: Pay-What-You-Want (Recommended)

This allows users to pay any amount (including $0) while encouraging support:

1. **Upload your game to itch.io**
   - Go to https://itch.io/game/new
   - Upload `index.html`, `app.js`, and `styles.css`
   - Set "Kind of project" to "HTML"
   - Check "This file will be played in the browser"

2. **Configure Pricing**
   - Under "Pricing", select "Pay what you want"
   - Set a suggested price (e.g., $3.00)
   - Set minimum price to $0.00 (or higher if you prefer)

3. **Premium Features Behavior**
   - Users who pay $0: Get free version
   - Users who pay any amount: Automatically unlock premium features
   - The itch.io API will detect purchases and unlock premium content

### Option 2: Fixed Price

For a traditional paid model:

1. Set "Pricing" to "Paid"
2. Enter your price (e.g., $5.00)
3. Only purchasers can access the tool
4. Premium features auto-unlock for all users

### Option 3: Donation Model (Free + Tips)

Keep everything free but allow donations:

1. Set pricing to "No payments"
2. Enable "Supporter/donate button" in your project settings
3. Modify `app.js` to unlock premium features for all users by default
4. Users can still support via tips

## How the Premium Unlock Works

The tool integrates with the itch.io JavaScript API:

```javascript
// Auto-detects if user purchased on itch.io
if (status.purchased) {
    unlockPremium(); // Activates all premium features
}
```

Premium features include:
- Advanced analytics dashboard
- Unlimited roll history (vs 50 rolls for free)
- Export to Markdown
- Import/export preset collections

## Installation & Deployment

### Local Testing

1. Clone this repository
2. Open `index.html` in a web browser
3. Use the "Unlock Premium" button to test premium features locally

### Deploy to Itch.io

1. **Prepare Files**
   ```bash
   # Your upload should include:
   - index.html
   - app.js
   - styles.css
   ```

2. **Upload to itch.io**
   - Create a new project at https://itch.io/game/new
   - Set "Kind of project" to "HTML"
   - Upload all three files
   - Mark `index.html` as the main file
   - Check "This file will be played in the browser"
   - Set viewport dimensions to 1200x900 (or "Automatically adjust")

3. **Configure Embed Options**
   - Enable "Mobile friendly" for responsive design
   - Enable "Fullscreen button"
   - Set "Embed options" to "Click to launch in fullscreen"

4. **Set Up Payments**
   - Choose your pricing model (see options above)
   - Add payment information to your account
   - Configure payout settings

## Testing the Integration

### Before Publishing
1. Set pricing to "Pay what you want" with $0 minimum
2. Open the page in "Preview mode"
3. Test the purchase flow
4. Verify premium features unlock after "purchase"

### Testing Premium Features Locally
The tool includes a testing mode - when not on itch.io, clicking "Unlock Premium" will prompt you to unlock features for testing.

## Revenue Strategies

### Recommended Pricing Models

1. **Pay-What-You-Want ($3 suggested)**
   - Best for building audience
   - Users appreciate flexibility
   - Often earn more than fixed price

2. **Freemium (Free + $5 premium)**
   - Free version limited to 50 roll history
   - Premium adds unlimited history + analytics
   - Clear value proposition

3. **Donation Model**
   - Everything free, tips appreciated
   - Builds goodwill
   - Good for beta/early access

### Marketing Your Tool

- **Description Tips:**
  - Highlight the tryptych system's uniqueness
  - Show screenshots of the beautiful UI
  - List premium features clearly
  - Mention export capabilities for session logs

- **Tags to Use:**
  - ttrpg
  - dice-roller
  - tool
  - rpg
  - character-creation

## Customization

### Changing Colors
Edit the CSS variables in `styles.css`:
```css
:root {
    --hero-gold: #d4af37;
    --bright-gold: #f4d03f;
    /* etc. */
}
```

### Adding More Premium Features
Edit `app.js` and add features behind the `isPremium` check:
```javascript
if (isPremium) {
    // Your premium feature here
}
```

### Modifying Dice Outcomes
Edit the `OUTCOME_BANDS` array in `app.js`:
```javascript
const OUTCOME_BANDS = [
    { name: 'Miss', min: -999, max: 5, className: 'miss' },
    // Add or modify bands
];
```

## Technical Details

- **Framework**: Vanilla JavaScript (no dependencies!)
- **Storage**: LocalStorage for persistence
- **API**: Itch.io JavaScript API for purchase detection
- **Responsive**: Works on desktop, tablet, and mobile
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)

## License

This code is provided as-is for your use. Feel free to customize and monetize!

## Support

Questions about setup? Check out:
- [Itch.io HTML5 Game Guide](https://itch.io/docs/creators/html5)
- [Itch.io API Documentation](https://itch.io/docs/api/javascript)

---

**Built for the Zeros to Heroes TTRPG community** 🎲✨