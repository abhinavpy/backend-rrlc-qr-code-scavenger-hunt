# filepath: c:\Users\91895\OneDrive\Desktop\OpportunityHack_SummerInternship_QRCode_Scavenger_Hunt\backend\Dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install with legacy peer deps to handle any conflicts)
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy app source
COPY . .

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /usr/src/app
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "server.js"]