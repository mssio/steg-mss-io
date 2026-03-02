# Use the official Bun image to run the application
FROM oven/bun:debian

# Set the work directory to `/app`
WORKDIR /app

# Copy the package.json and bun.lock into the container
COPY package.json bun.lock ./

# Install the dependencies
RUN bun install --production --frozen-lockfile

# Copy the rest of the application into the container
COPY . .

# Expose the default port
EXPOSE 3000

# Run the application
CMD ["bun", "src/index.ts"]
