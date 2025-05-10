#!/bin/bash

# Script: init-project.sh
# Description: Initializes the complete Healthcare Assistant project structure

echo "🚀 Creating Healthcare Assistant project structure..."

# Project root
PROJECT_DIR="healthcare-assistant"
mkdir -p "$PROJECT_DIR" && cd "$PROJECT_DIR"

# Create backend structure with improved modularity
mkdir -p backend/src/{controllers,services/{external,internal},models,routes,middleware,utils}
mkdir -p backend/db/{migrations,seeders}
mkdir -p backend/tests
mkdir -p backend/logs  # Added logs directory for better logging management

# Create frontend structure
mkdir -p frontend/{public,src/{components,pages}}

# Create documentation folder
mkdir -p docs

# Initialize Node.js for backend (Express) if package.json doesn't exist
cd backend
if [ ! -f package.json ]; then
  npm init -y
fi

echo "✅ Healthcare Assistant project structure created successfully!"

