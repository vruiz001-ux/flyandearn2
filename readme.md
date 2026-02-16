# FlyAndEarn.eu - Netlify Deployment

## 🚀 Quick Deploy to Netlify

### Option 1: Drag & Drop (Fastest)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag this entire folder onto the page
3. Wait for deployment (< 1 minute)
4. Get your live URL!

### Option 2: Connect Git Repository
1. Push this folder to GitHub/GitLab/Bitbucket
2. Go to [app.netlify.com](https://app.netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect your repository
5. Deploy settings:
   - Build command: (leave empty)
   - Publish directory: `/`

### Option 3: Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod --dir=.
```

## 📁 Files Included

```
flyandearn-netlify/
├── index.html          # Main landing page
├── wallet.html         # Wallet dashboard
├── 404.html            # Custom 404 page
├── favicon.svg         # Site icon
├── og-image.svg        # Social sharing image
├── robots.txt          # SEO crawler rules
├── sitemap.xml         # SEO sitemap
├── netlify.toml        # Netlify configuration
├── _redirects          # URL redirects
└── README.md           # This file
```

## ⚙️ Configuration

### netlify.toml
- Security headers (X-Frame-Options, CSP, etc.)
- Cache control for assets
- Custom 404 page

### _redirects
- `/wallet` → `/wallet.html`
- `/app/*` → `/wallet.html` (SPA support)

## 🔗 After Deployment

### 1. Set Custom Domain
1. Go to Site settings → Domain management
2. Add custom domain: `flyandearn.eu`
3. Configure DNS at your registrar:
   ```
   Type: CNAME
   Name: www
   Value: your-site-name.netlify.app
   
   Type: A
   Name: @
   Value: 75.2.60.5 (Netlify load balancer)
   ```

### 2. Enable HTTPS
- Netlify provides free SSL automatically
- Wait for DNS propagation (up to 48 hours)
- HTTPS will be enabled automatically

### 3. Set Environment Variables (if using API)
Go to Site settings → Environment variables:
```
DATABASE_URL=postgresql://...
NODE_ENV=production
```

## 📊 Analytics

### Enable Netlify Analytics
1. Go to Site settings → Analytics
2. Enable Netlify Analytics ($9/month)

### Or use free alternatives:
- Add Google Analytics 4 code to index.html
- Add Plausible Analytics (privacy-focused)

## 🔒 Password Protection (Optional)

For staging/preview before public launch:

1. Go to Site settings → Access control
2. Enable "Password protection"
3. Set a password
4. Share password with testers only

## 📝 Checklist Before Going Live

- [ ] Test all pages load correctly
- [ ] Test wallet functionality
- [ ] Test mobile responsiveness
- [ ] Check all links work
- [ ] Verify favicon appears
- [ ] Test social sharing (og:image)
- [ ] Submit sitemap to Google Search Console
- [ ] Remove password protection (if set)

## 🆘 Troubleshooting

### Page not found after deploy
- Clear browser cache
- Check file names are lowercase
- Verify netlify.toml is correct

### CSS/fonts not loading
- Check browser console for errors
- Verify font URLs are HTTPS

### Custom domain not working
- Wait up to 48h for DNS propagation
- Use [dnschecker.org](https://dnschecker.org) to verify

## 📞 Support

- Netlify Docs: https://docs.netlify.com
- Netlify Community: https://answers.netlify.com
- FlyAndEarn Support: reklamacje@tropos.pl

---

**Ready to deploy?** Just drag this folder to Netlify! 🚀
