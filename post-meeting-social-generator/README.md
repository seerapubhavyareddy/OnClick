# Meeting Social Generator

A Next.js application that automatically transforms meeting insights into engaging social media content. Connect your Google Calendar, enable AI-powered note-taking bots for meetings, and generate professional social media posts from meeting transcripts.

## 🎥 Demo & Screenshots

### 📹 Full Demo Video
[![Meeting Social Generator Demo] (https://youtu.be/qyAcD0-XlDA)]

*Click above to watch the complete walkthrough (12 minutes)*



### ⚡ Key Features Demo
- 🗓️ **Multi-Calendar Integration**: Connect multiple Google accounts
- 🤖 **Smart Meeting Bots**: AI-powered note-taking with Recall.ai
- ✨ **Content Generation**: Transform transcripts into social posts
- 📤 **One-Click Publishing**: Direct posting to LinkedIn & Facebook

## 🚀 Features

- **Multi-Account Google Calendar Integration** - Connect multiple Google accounts and view all calendar events
- **AI-Powered Meeting Bots** - Automatically join meetings via Recall.ai and generate transcripts
- **Smart Content Generation** - Use Claude AI to create LinkedIn and Facebook posts from meeting insights
- **Social Media Publishing** - Connect LinkedIn and Facebook accounts to post directly
- **Real-time Meeting Processing** - Automatic polling and processing of meeting transcripts
- **User-Friendly Dashboard** - Intuitive interface to manage meetings, view transcripts, and generate content

## 🛠️ Tech Stack

- **Frontend:** Next.js 14 with TypeScript
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js (Google OAuth)
- **AI Services:** 
  - Anthropic Claude for content generation
  - Recall.ai for meeting recording and transcription
- **Social Media:** LinkedIn and Facebook OAuth integration
- **Deployment:** Vercel
- **Styling:** Tailwind CSS

## 📋 Prerequisites

Before running this project, you need:

- Node.js 18+ and npm
- PostgreSQL database (or Supabase)
- Google Cloud Console project with OAuth credentials
- LinkedIn Developer App
- Recall.ai API access
- Anthropic API key
- Vercel account (for deployment)

## 🔧 Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# LinkedIn OAuth
LINKEDIN_CLIENT_ID="your-linkedin-client-id"
LINKEDIN_CLIENT_SECRET="your-linkedin-client-secret"

# Recall.ai
RECALL_API_KEY="your-recall-api-key"
RECALL_API_URL="https://us-east-1.recall.ai/api/v1"

# AI Service
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Database Configuration
PRISMA_DISABLE_PREPARED_STATEMENTS=true
DATABASE_CONNECTION_LIMIT=1
```

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/meeting-social-generator.git
cd meeting-social-generator
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push
```

### 4. Configure OAuth Applications

#### Google Cloud Console:
1. Create a new project or select existing one
2. Enable Google Calendar API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-domain.vercel.app/api/auth/callback/google`

#### LinkedIn Developer Portal:
1. Create a new LinkedIn app
2. Request "Sign In with LinkedIn using OpenID Connect" product
3. Add redirect URLs:
   - `http://localhost:3000/api/social/linkedin-callback`
   - `https://your-domain.vercel.app/api/social/linkedin-callback`

#### Recall.ai:
1. Sign up at [recall.ai](https://recall.ai)
2. Get your API key from the dashboard
3. Add `webshookeng@gmail.com` as a test user if required

#### Anthropic:
1. Get an API key from [Anthropic Console](https://console.anthropic.com)

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📁 Project Structure

```
meeting-social-generator/
├── src/
│   ├── app/                     # Next.js 14 App Router
│   │   ├── page.tsx            # Main dashboard
│   │   ├── settings/           # Settings page
│   │   └── layout.tsx          # Root layout
│   └── types/                  # TypeScript type definitions
├── pages/
│   └── api/                    # API routes
│       ├── auth/               # NextAuth configuration
│       ├── calendar/           # Google Calendar integration
│       ├── meetings/           # Meeting management
│       ├── social/             # Social media integration
│       ├── ai/                 # AI content generation
│       └── polling/            # Recall.ai polling service
├── lib/                        # Utility libraries
│   ├── prisma.ts              # Database client
│   ├── google-calendar.ts     # Google Calendar API
│   ├── recall-client.ts       # Recall.ai API client
│   ├── ai-content-service.ts  # AI content generation
│   ├── polling-service.ts     # Background polling
│   └── multiple-calendar-service.ts # Multi-account support
├── prisma/
│   └── schema.prisma          # Database schema
└── middleware.ts              # Next.js middleware
```

## 🔄 How It Works

1. **Authentication**: Users sign in with Google to access their calendar
2. **Calendar Integration**: The app fetches upcoming meetings from connected Google accounts
3. **Bot Scheduling**: Users can toggle note-taking bots for meetings with video links
4. **Meeting Recording**: Recall.ai bots join meetings and generate transcripts
5. **Content Generation**: Claude AI processes transcripts to create social media posts
6. **Social Publishing**: Users can review and publish generated content to LinkedIn/Facebook

## 🎯 Key Features Explained

### Multi-Account Google Calendar
- Support for connecting multiple Google accounts
- Unified view of all calendar events
- Automatic token refresh handling

### AI-Powered Meeting Bots
- Integration with Recall.ai for meeting recording
- Automatic bot scheduling 5 minutes before meetings
- Real-time polling for transcript availability
- Support for Zoom, Google Meet, Microsoft Teams

### Smart Content Generation
- Claude AI analyzes meeting transcripts
- Generates platform-specific content (LinkedIn vs Facebook)
- Maintains professional tone for business context
- Includes relevant hashtags and engagement elements

### Social Media Integration
- Real LinkedIn OAuth integration
- Facebook demo mode (requires business verification for production)
- Direct publishing capabilities
- Connection management in settings

## 🚀 Deployment

### Deploy to Vercel

1. **Connect Repository**:
   ```bash
   vercel --prod
   ```

2. **Set Environment Variables** in Vercel Dashboard

3. **Update OAuth Redirect URIs** in Google and LinkedIn consoles with production URLs

4. **Verify Database Connection** and run migrations if needed

### Environment Variables for Production

```bash
NEXTAUTH_URL=https://your-app-domain.vercel.app
DATABASE_URL=your-production-database-url
# ... other environment variables
```

## 🔐 Security Considerations

- All OAuth flows use secure PKCE implementation
- Database queries use Prisma's built-in SQL injection protection
- API routes include proper authentication checks
- Social media tokens are encrypted and stored securely
- CORS policies restrict API access to authorized domains

## 🐛 Troubleshooting

### Common Issues

**Google OAuth "invalid_request" error:**
- Check redirect URIs in Google Console
- Verify NEXTAUTH_URL environment variable
- Ensure no `${VERCEL_URL}` literals in configuration

**LinkedIn connection fails:**
- Verify LinkedIn app has "Sign In with LinkedIn using OpenID Connect" approved
- Check redirect URI matches exactly (case-sensitive)
- Clear browser cache and try incognito mode

**Recall.ai bot doesn't join meetings:**
- Verify meeting URL contains valid video conference link
- Check Recall.ai API key permissions
- Ensure meeting is scheduled for future time

**Database connection issues:**
- Verify DATABASE_URL format and credentials
- Check connection limits and pooling settings
- Ensure database accepts connections from Vercel IPs

## 📚 API Documentation

### Calendar Events
- `GET /api/calendar/events` - Fetch upcoming calendar events
- `POST /api/calendar/events` - Refresh calendar data

### Meeting Management
- `POST /api/meetings/toggle-notetaker` - Enable/disable bot for meeting
- `GET /api/meetings/past` - Get completed meetings with transcripts

### AI Content Generation
- `POST /api/ai/generate` - Generate social media content from transcript

### Social Media
- `POST /api/social/connect-linkedin` - Initiate LinkedIn connection
- `POST /api/social/post` - Publish content to social platforms

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Recall.ai](https://recall.ai) for meeting recording capabilities
- [Anthropic](https://anthropic.com) for Claude AI integration
- [Vercel](https://vercel.com) for hosting and deployment
- [Next.js](https://nextjs.org) team for the amazing framework

## 📞 Support

For support, email your-email@example.com or create an issue in the GitHub repository.

---

**Built with ❤️ for better meeting productivity and social media engagement.**