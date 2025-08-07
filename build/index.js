#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { S3Client, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { promises as fs } from 'fs';
import * as mime from 'mime-types';
// Check required environment variables
const requiredEnvVars = ['DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_ENDPOINT', 'DO_SPACES_BUCKET'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}
// Initialize S3 client for DO Spaces
const s3Client = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: 'us-east-1', // DO Spaces uses this region
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    },
});
class DOStorageServer {
    constructor() {
        this.server = new Server({
            name: 'do-storage-server',
            version: '0.1.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'upload_object',
                    description: 'Upload a file or data to DO Spaces',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            key: {
                                type: 'string',
                                description: 'Object key (path) in the bucket',
                            },
                            content: {
                                type: 'string',
                                description: 'Content to upload',
                            },
                            contentType: {
                                type: 'string',
                                description: 'MIME type of the content',
                            },
                        },
                        required: ['key', 'content'],
                    },
                },
                {
                    name: 'upload_file',
                    description: 'Upload a file from disk to DO Spaces',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            key: {
                                type: 'string',
                                description: 'Object key (path) in the bucket',
                            },
                            filepath: {
                                type: 'string',
                                description: 'Local file path to upload',
                            },
                            contentType: {
                                type: 'string',
                                description: 'Optional MIME type override',
                            },
                        },
                        required: ['key', 'filepath'],
                    },
                },
                {
                    name: 'download_object',
                    description: 'Download an object from DO Spaces',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            key: {
                                type: 'string',
                                description: 'Object key (path) in the bucket',
                            },
                        },
                        required: ['key'],
                    },
                },
                {
                    name: 'delete_object',
                    description: 'Delete an object from DO Spaces',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            key: {
                                type: 'string',
                                description: 'Object key (path) in the bucket',
                            },
                        },
                        required: ['key'],
                    },
                },
                {
                    name: 'list_objects',
                    description: 'List objects in DO Spaces bucket',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            prefix: {
                                type: 'string',
                                description: 'Prefix to filter objects by',
                            },
                            maxKeys: {
                                type: 'number',
                                description: 'Maximum number of keys to return',
                            },
                        },
                        required: [],
                    },
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            switch (request.params.name) {
                case 'upload_object':
                    return await this.handleUpload(request.params.arguments);
                case 'upload_file':
                    return await this.handleUploadFile(request.params.arguments);
                case 'download_object':
                    return await this.handleDownload(request.params.arguments);
                case 'delete_object':
                    return await this.handleDelete(request.params.arguments);
                case 'list_objects':
                    return await this.handleList(request.params.arguments);
                default:
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
        });
    }
    async handleUpload(args) {
        if (!args.key || !args.content) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: key and content');
        }
        try {
            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: process.env.DO_SPACES_BUCKET,
                    Key: args.key,
                    Body: args.content,
                    ContentType: args.contentType || 'application/octet-stream',
                },
            });
            await upload.done();
            return {
                content: [
                    {
                        type: 'text',
                        text: `Successfully uploaded object: ${args.key}`,
                    },
                ],
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Upload failed: ${error.message}`);
        }
    }
    async handleUploadFile(args) {
        if (!args.key || !args.filepath) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: key and filepath');
        }
        try {
            // Read file from disk
            const fileContent = await fs.readFile(args.filepath);
            // Auto-detect content type if not provided
            const contentType = args.contentType || mime.lookup(args.filepath) || 'application/octet-stream';
            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: process.env.DO_SPACES_BUCKET,
                    Key: args.key,
                    Body: fileContent,
                    ContentType: contentType,
                },
            });
            await upload.done();
            return {
                content: [
                    {
                        type: 'text',
                        text: `Successfully uploaded file: ${args.key}`,
                    },
                ],
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Upload failed: ${error.message}`);
        }
    }
    async handleDownload(args) {
        if (!args.key) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: key');
        }
        try {
            const command = new GetObjectCommand({
                Bucket: process.env.DO_SPACES_BUCKET,
                Key: args.key,
            });
            const response = await s3Client.send(command);
            if (!response.Body) {
                throw new Error('No content in response');
            }
            const stream = response.Body;
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
            }
            const content = Buffer.concat(chunks).toString('utf-8');
            return {
                content: [
                    {
                        type: 'text',
                        text: content,
                    },
                ],
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Download failed: ${error.message}`);
        }
    }
    async handleDelete(args) {
        if (!args.key) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: key');
        }
        try {
            const command = new DeleteObjectCommand({
                Bucket: process.env.DO_SPACES_BUCKET,
                Key: args.key,
            });
            await s3Client.send(command);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Successfully deleted object: ${args.key}`,
                    },
                ],
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Delete failed: ${error.message}`);
        }
    }
    async handleList(args) {
        try {
            const command = new ListObjectsV2Command({
                Bucket: process.env.DO_SPACES_BUCKET,
                Prefix: args.prefix,
                MaxKeys: args.maxKeys,
            });
            const response = await s3Client.send(command);
            const objects = response.Contents?.map(obj => ({
                key: obj.Key,
                size: obj.Size,
                lastModified: obj.LastModified,
            })) || [];
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(objects, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `List failed: ${error.message}`);
        }
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('DO Storage MCP server running on stdio');
    }
}
const server = new DOStorageServer();
server.run().catch(console.error);
