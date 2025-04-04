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
- GitHub App credentials
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
# Application URL - IMPORTANT for GitHub App webhooks
APP_BASE_URL=http://localhost:5000

# GitHub App credentials - Create at https://github.com/settings/apps
GITHUB_APP_ID=your_github_app_id
GITHUB_APP_NAME=your_app_name
GITHUB_PRIVATE_KEY=your_private_key
GITHUB_INSTALLATION_ID=your_installation_id
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# OpenAI API key - Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key

# Session secret for Express session cookies (generate a secure random string)
SESSION_SECRET=a_secure_random_string_for_session_cookies

# MongoDB connection URI - Optional, falls back to in-memory storage if not provided
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/codeweaver?retryWrites=true&w=majority
```

### GitHub App Setup

1. Go to your GitHub account Settings > Developer Settings > GitHub Apps
2. Create a new GitHub App
3. Set the Homepage URL to match your APP_BASE_URL in .env
4. Set the Webhook URL to `${APP_BASE_URL}/api/github/webhook`
5. Generate and set a Webhook Secret
6. Configure the following permissions:
   - Repository permissions:
     - Contents: Read & write
     - Pull requests: Read & write
     - Metadata: Read-only
   - User permissions:
     - Email addresses: Read-only
     - Profile: Read-only
7. Subscribe to the following events:
   - Installation
   - Pull requests
   - Push
   - Repository
8. After creating the app, note down:
   - App ID
   - Generate and download the private key
   - Installation ID (after installing the app on your account)

## Usage

### Development

You'll need to run three components in separate terminals:

```bash
# Terminal 1: Start the main application server
npm run dev

# Terminal 2: Navigate to the multi-agent framework directory and start the backend
cd shared/multi_agent_framework_v2
uvicorn backend.main:app --reload --port 8000

```

The application will be available at:
- Main application: http://localhost:5000
- Multi-agent backend: http://localhost:8000


### Multi-Agent Framework

The multi-agent system provides intelligent code analysis through several specialized agents:

- **LintingAgent**: Analyzes code style and best practices
- **RefactoringAgent**: Suggests code structure improvements
- **DependencyAgent**: Manages package dependencies and security
- **LLMReviewAgent**: Provides high-level architectural insights
- **MetaReviewAgent**: Validates and prioritizes suggestions

### Prerequisites for Multi-Agent System

```bash
# Install Python dependencies for the multi-agent framework
cd shared/multi_agent_framework_2
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your OpenAI API key and other settings
```

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
- `GET /api/auth/github` - Initiate GitHub App installation
- `POST /api/github/webhook` - GitHub App webhook handler
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

#### GitHub App Connection Issues

If you encounter issues with GitHub App authentication:

1. Verify your GitHub App settings match the webhook URL in your environment configuration
2. Check that the private key is correctly formatted (should include newlines)
3. Ensure the Installation ID is correct and the app is installed on your account
4. Check the webhook delivery logs in GitHub App settings for any errors

#### MongoDB Connection Issues

If MongoDB connection fails, the application will automatically fall back to in-memory storage. To fix MongoDB connection:

1. Verify your MONGO_URI is correct and accessible from your deployment environment
2. Ensure you've included the database name in the URI (e.g., `.../codeweaver?retryWrites=true`)

## License

[GNU Lesser General Public License](LICENSE)
