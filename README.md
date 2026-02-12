<div align="center">
    <img src="https://raw.githubusercontent.com/nDriaDev/vite-plugin-universal-api/main/resources/logo.png" alt="Logo"/>
<br>
</div>

# MongoGridFS to AWS S3 Uploader
![NodeJs](https://img.shields.io/badge/node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white)
![Typescript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/-MongoDB-13aa52?style=for-the-badge&logo=mongodb&logoColor=white)
![Amazon S3](https://img.shields.io/badge/Amazon%20S3-FF9900?style=for-the-badge&logo=amazons3&logoColor=white)

This project provides a comprehensive solution for migrating data from MongoDB to AWS S3. It allows users to stream files directly from GridFS and export collection data—or the results of complex aggregation pipelines—as `.jsonl` files to an S3 bucket.

The application features a user-friendly web interface with a powerful query builder, real-time upload progress tracking using Server-Sent Events (SSE), and a simple S3 bucket browser.

## Features

-   **Flexible Data Migration**: Upload entire collections or the results of specific find queries and aggregation pipelines.
-   **GridFS to S3 Streaming**: Efficiently stream large files from MongoDB GridFS to an S3 bucket without loading them entirely into memory.
-   **Powerful Query Interface (v2)**:
    -   Dynamically discover and select MongoDB collections.
    -   Build `find` queries using a visual, rule-based builder.
    -   Construct complex aggregation pipelines with a dedicated editor and stage helpers.
-   **Real-time Progress Monitoring**: Monitor uploads in real-time through a web UI powered by Server-Sent Events (SSE).
-   **Efficient Uploading**: Utilizes streaming and concurrent uploads (`p-limit`) to handle large datasets and numerous files efficiently.
-   **S3 Bucket Management**: A web interface to list, download, and delete files/folders within your S3 bucket.
-   **API Documentation**: Integrated Swagger UI provides clear and interactive API documentation.
-   **Configurable**: Easily set up database connections, AWS credentials, and proxy settings through an environment file.

## Prerequisites

-   Node.js (v22.20.0 or later)
-   Access to a MongoDB instance with data.
-   An AWS account with an S3 bucket and credentials with necessary permissions (e.g., `s3:PutObject`, `s3:ListObjectsV2`, `s3:GetObject`, `s3:DeleteObjects`).

## Setup and Configuration

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ndriadev/mongogridfs_2_awss3.git
    cd mongogridfs_2_awss3
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure environment variables:**
    Create a `.env` file inside the `environment/` directory by copying the example file.

    ```bash
    cp environment/.env.example environment/.env
    ```

    Then, edit `environment/.env` and fill in the required values.

### Environment Variables

| Variable                                  | Description                                                                                             | Required |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- | :------: |
| `IS_LOCAL`                                | Set to `true` if running locally, `false` if deploying in an environment that requires a proxy for AWS. |   Yes    |
| `PORT`                                    | The port the server will run on (e.g., `3000`).                                                          |   Yes    |
| `PROXY_HOST`                              | The proxy host URL (e.g., `http://user:pass@host:port`). Required if `IS_LOCAL` is `false`.              |    No    |
| `MONGO_DB_NAME`                           | The name of your MongoDB database.                                                                      |   Yes    |
| `MONGO_CONNECTION_STRING`                 | The connection string for your MongoDB instance.                                                        |   Yes    |
| `AWS_ACCESS_KEY_ID`                       | Your AWS access key ID.                                                                                 |   Yes    |
| `AWS_SECRET_ACCESS_KEY`                   | Your AWS secret access key.                                                                             |   Yes    |
| `AWS_REGION`                              | The AWS region of your S3 bucket (e.g., `us-east-1`).                                                   |   Yes    |
| `AWS_BUCKET_NAME`                         | The name of your AWS S3 bucket.                                                                         |   Yes    |
| **V1 API Specific (optional for v2)**     |                                                                                                         |          |
| `MONGO_DB_COLLECTION`                     | The default collection to query against in the v1 API.                                                  |    No    |
| `MONGO_DB_COLLECTION_FIELD_FOR_ID_GRIDFS` | The field in the collection document that holds the identifier for the GridFS file.                       |    No    |
| `MONGO_DB_GRIDFS_BUCKET`                  | The name of the GridFS bucket.                                                                          |    No    |
| `MONGO_DB_GRIDFS_ID_PREFIX`               | A prefix to add to the GridFS file identifier before lookup.                                            |    No    |
| `MONGO_DB_GRIDFS_ID_SUFFIX`               | A suffix to add to the GridFS file identifier before lookup.                                            |    No    |
| `MONGO_DB_GRIDFS_FILE_EXTENSION`          | The file extension to append when uploading GridFS files to S3.                                         |    No    |
| `MONGO_DB_GRIDFS_CONTENT_TYPE`            | The `Content-Type` for files uploaded from GridFS.                                                      |    No    |
| `AWS_BUCKET_FOLDER_PREFIX`                | A default prefix (folder path) to use when interacting with the S3 bucket in the v1 API.                |    No    |

## Running the Application

### Development Mode

To run the application with hot-reloading using `tsx`:

```bash
npm run dev
```

### Production Mode

To build and run the optimized JavaScript version:

```bash
# 1. Build the TypeScript source
npm run build

# 2. Start the application
npm run start
```

## Usage

-   **Web Interface**: Once the application is running, access the main interface at `http://localhost:<PORT>/v2`. This provides the most advanced features for querying data and managing uploads.
-   **API Documentation**: A full Swagger/OpenAPI documentation for all API endpoints is available at `http://localhost:<PORT>/api-docs`.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
