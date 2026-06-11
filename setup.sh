#!/bin/bash

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}LMS Full Stack Health Check${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check Node.js
echo -e "${YELLOW}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${NC}"
else
    echo -e "${RED}✗ Node.js not found${NC}"
    exit 1
fi

# Check npm
echo -e "${YELLOW}Checking npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓ npm ${NPM_VERSION}${NC}"
else
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi

# Check dependencies
echo -e "\n${YELLOW}Checking dependencies...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Dependencies installed${NC}"
    else
        echo -e "${RED}✗ Failed to install dependencies${NC}"
        exit 1
    fi
fi

# Build check
echo -e "\n${YELLOW}Building project...${NC}"
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    npm run build
    exit 1
fi

# Environment check
echo -e "\n${YELLOW}Checking environment files...${NC}"
if [ -f "apps/api/.env" ]; then
    echo -e "${GREEN}✓ Backend .env found${NC}"
else
    echo -e "${YELLOW}⚠ Backend .env not found (creating)${NC}"
    cp apps/api/.env.example apps/api/.env 2>/dev/null || \
    cat > apps/api/.env << 'EOF'
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET=super-secret-key-change-in-production-12345678
JWT_REFRESH_SECRET=super-secret-refresh-key-change-in-production-12345678
EOF
    echo -e "${GREEN}✓ Created .env${NC}"
fi

if [ -f "apps/web/.env" ]; then
    echo -e "${GREEN}✓ Frontend .env found${NC}"
else
    echo -e "${YELLOW}⚠ Frontend .env not found (creating)${NC}"
    cat > apps/web/.env << 'EOF'
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=LMS Platform
VITE_APP_ENVIRONMENT=development
EOF
    echo -e "${GREEN}✓ Created .env${NC}"
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✓ All checks passed!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}To start development servers:${NC}"
echo -e "${BLUE}npm run dev${NC}\n"

echo -e "${YELLOW}Frontend will be available at:${NC}"
echo -e "${BLUE}http://localhost:5173${NC}\n"

echo -e "${YELLOW}Backend API will be available at:${NC}"
echo -e "${BLUE}http://localhost:3000${NC}\n"

echo -e "${YELLOW}Health check endpoints:${NC}"
echo -e "${BLUE}curl http://localhost:3000/api/health${NC}\n"

echo -e "${YELLOW}Test registration:${NC}"
echo -e "${BLUE}curl -X POST http://localhost:3000/api/auth/register \\${NC}"
echo -e "${BLUE}  -H 'Content-Type: application/json' \\${NC}"
echo -e "${BLUE}  -d '{${NC}"
echo -e "${BLUE}    \"email\": \"test@example.com\",${NC}"
echo -e "${BLUE}    \"password\": \"Password123\",${NC}"
echo -e "${BLUE}    \"name\": \"Test User\"${NC}"
echo -e "${BLUE}  }'${NC}\n"
