# Use a lightweight Node.js 20 image
FROM node:20-slim

# Install Python 3 (Required for your PDF shredder)
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files 
# We use wildcard * to ensure it doesn't fail if lockfile is missing
COPY package*.json ./

# Verify files are actually there (for debugging)
RUN ls -la

# Install dependencies
RUN npm install

# Copy the rest of the server code
COPY . .

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "index.js"]