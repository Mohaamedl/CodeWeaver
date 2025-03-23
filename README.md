# CodeWeaver

A web-based tool for codebase analysis and AI-assisted project creation with GitHub integration.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

## Overview

CodeWeaver is a modern web application designed to analyze codebases and provide architectural insights and recommendations. It integrates with GitHub to access repositories and uses OpenAI to generate intelligent recommendations for code architecture, design patterns, and best practices.

The application helps developers understand complex codebases, identify architectural improvements, and create better software designs through AI-assisted analysis.

## Features

- **GitHub Integration**: Connect with your GitHub account to analyze your repositories
- **AI-Powered Code Analysis**: Leverage OpenAI to get meaningful insights about your code
- **Interactive Assistant**: Chat with an AI assistant to discuss architectural decisions
- **Architectural Plan Generation**: Generate comprehensive architectural plans for new projects
- **Code Pattern Recognition**: Identify common design patterns and architectural issues
- **Exportable Documentation**: Download analysis reports and architectural plans

## Tech Stack

### Backend
- Node.js with Express
- TypeScript
- MongoDB for data persistence
- Express Session for authentication
- Drizzle ORM

### Frontend
- React
- TypeScript
- TanStack Query for data fetching
- Tailwind CSS for styling
- Shadcn/UI components
- Wouter for routing

### External Services
- GitHub API for repository access
- OpenAI API for code analysis and recommendations

## Installation

### Prerequisites

- Node.js (v16+)
- npm or yarn
- MongoDB (optional - falls back to in-memory storage)
- GitHub OAuth App credentials
- OpenAI API key

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/Mohaamedl/CodeWeaver.git
cd codeweaver

# Install dependencies
npm install
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Application URL - IMPORTANT for GitHub OAuth redirect
APP_BASE_URL=http://localhost:5000

# GitHub OAuth credentials - Create at https://github.com/settings/developers
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# OpenAI API key - Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key

# Session secret for Express session cookies (generate a secure random string)
SESSION_SECRET=a_secure_random_string_for_session_cookies

# MongoDB connection URI - Optional, falls back to in-memory storage if not provided
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/codeweaver?retryWrites=true&w=majority
```

### GitHub OAuth App Setup

1. Go to your GitHub account Settings > Developer Settings > OAuth Apps
2. Create a new OAuth App
3. Set the Homepage URL to match your APP_BASE_URL in .env
4. Set the Authorization callback URL to `${APP_BASE_URL}/api/auth/github/callback`

## Usage

### Development

```bash
# Start development server
npm run dev
```

This will start the server on http://localhost:5000 with both the backend API and frontend application.

### Production

```bash
# Build the application
npm run build

# Start the production server
npm start
```

## API Documentation

### Authentication Endpoints

- `GET /api/auth/status` - Check authentication status
- `GET /api/auth/github` - Initiate GitHub OAuth flow
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `POST /api/auth/logout` - Log out the current user

### GitHub Integration Endpoints

- `GET /api/repositories` - List user's GitHub repositories
- `GET /api/repository/:owner/:repo/tree` - Get repository tree structure
- `GET /api/repository/:owner/:repo/contents/:path` - Get file contents

### Analysis Endpoints

- `POST /api/analyze` - Analyze a repository structure
- `POST /api/assistant/conversations` - Start a new assistant conversation
- `POST /api/assistant/conversations/:conversationId/messages` - Send a message to the assistant
- `POST /api/assistant/conversations/:conversationId/generate-plan` - Generate an architectural plan
- `GET /api/assistant/conversations/:conversationId/export` - Export the plan

## Troubleshooting

### Common Issues

#### GitHub OAuth Connection Issues

If you encounter "github.com refused to connect" errors when authenticating with GitHub:

1. Verify your GitHub OAuth App settings match the callback URL in your environment configuration
2. Check for network restrictions if deploying on platforms like Replit
3. Ensure both Homepage URL and Authorization callback URL use the same protocol (HTTP or HTTPS)

#### MongoDB Connection Issues

If MongoDB connection fails, the application will automatically fall back to in-memory storage. To fix MongoDB connection:

1. Verify your MONGO_URI is correct and accessible from your deployment environment
2. Ensure you've included the database name in the URI (e.g., `.../codeweaver?retryWrites=true`)

## License

[MIT License](LICENSE)
