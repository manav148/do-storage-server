# do-storage-server

MCP server for DigitalOcean Spaces storage operations. This Model Context Protocol (MCP) server enables LLMs to interact with DigitalOcean Spaces for file upload, download, list, and management operations.

## Features

- 📤 Upload files and data to DO Spaces
- 📥 Download objects from DO Spaces
- 📋 List objects with prefix filtering
- 🗑️ Delete objects
- 🔐 Manage file permissions (public/private)
- 🔄 S3-compatible API using AWS SDK

## Installation

```bash
npm install -g do-storage-server
```

## Prerequisites

1. DigitalOcean Spaces account
2. Access Key ID and Secret Access Key for your Spaces
3. Existing Space (bucket) created in your DO account
4. Node.js 18.0.0 or higher

## Configuration

Set the following environment variables:

```bash
export DO_SPACES_KEY="your-access-key-id"
export DO_SPACES_SECRET="your-secret-access-key"
export DO_SPACES_REGION="nyc3"  # or your region
export DO_SPACES_BUCKET="your-bucket-name"
export DO_SPACES_ENDPOINT="https://nyc3.digitaloceanspaces.com"  # or your endpoint
```

## Usage

### As an MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "do-storage": {
      "command": "do-storage-server",
      "env": {
        "DO_SPACES_KEY": "your-access-key-id",
        "DO_SPACES_SECRET": "your-secret-access-key",
        "DO_SPACES_REGION": "nyc3",
        "DO_SPACES_BUCKET": "your-bucket-name",
        "DO_SPACES_ENDPOINT": "https://nyc3.digitaloceanspaces.com"
      }
    }
  }
}
```

### Available Tools

#### upload_object
Upload text or data directly to DO Spaces.

```typescript
{
  "key": "path/to/file.txt",
  "content": "File content here",
  "contentType": "text/plain"  // optional
}
```

#### upload_file
Upload a file from disk to DO Spaces.

```typescript
{
  "key": "path/to/destination.jpg",
  "filepath": "/local/path/to/file.jpg",
  "contentType": "image/jpeg"  // optional, auto-detected if not provided
}
```

#### download_object
Download an object from DO Spaces.

```typescript
{
  "key": "path/to/file.txt"
}
```

#### list_objects
List objects in the bucket with optional filtering.

```typescript
{
  "prefix": "folder/",  // optional
  "maxKeys": 100        // optional, default 1000
}
```

#### delete_object
Delete an object from DO Spaces.

```typescript
{
  "key": "path/to/file.txt"
}
```

#### set_permissions
Set ACL permissions for objects (requires s3cmd installed).

```typescript
{
  "path": "s3://bucket-name/path/to/object",
  "acl": "public-read",  // or "private", "public-read-write", "authenticated-read"
  "recursive": false      // optional, for folders
}
```

## Example Usage with Claude

Once configured as an MCP server, you can interact with DO Spaces through Claude:

```
User: Upload my config.json file to the configs folder
Claude: I'll upload your config.json file to the configs folder in DO Spaces...

User: List all files in the images/ folder
Claude: Let me list the files in the images/ folder...

User: Make the logo.png file public
Claude: I'll set the logo.png file to public-read permissions...
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DO_SPACES_KEY` | DigitalOcean Spaces Access Key ID | Yes |
| `DO_SPACES_SECRET` | DigitalOcean Spaces Secret Access Key | Yes |
| `DO_SPACES_REGION` | Region of your Space (e.g., nyc3, sfo3, ams3) | Yes |
| `DO_SPACES_BUCKET` | Name of your Space (bucket) | Yes |
| `DO_SPACES_ENDPOINT` | Endpoint URL for your region | Yes |

## Regions and Endpoints

| Region | Endpoint |
|--------|----------|
| NYC3 | https://nyc3.digitaloceanspaces.com |
| SFO3 | https://sfo3.digitaloceanspaces.com |
| AMS3 | https://ams3.digitaloceanspaces.com |
| SGP1 | https://sgp1.digitaloceanspaces.com |
| FRA1 | https://fra1.digitaloceanspaces.com |

## Development

```bash
# Clone the repository
git clone https://github.com/manav148/do-storage-server.git
cd do-storage-server

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Run locally
node build/index.js
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or suggestions, please open an issue on [GitHub](https://github.com/manav148/do-storage-server/issues).