# DexQuest API

The backend for the DexQuest application, built with Node.js, Express, and MongoDB.

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT (Authentication)
- dotenv (Environment management)
- Multer (for file uploads)
- CORS enabled  

## Getting Started  

### 1. Clone the repo  

git clone https://github.com/dennisk94/DexQuest-API  

### 2. Install Dependencies  

cd DexQuest-API-main  
npm install  

### 3. Setup environment variables  

PORT=3001  
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/database-name  
JWT_SECRET=your_jwt_secret   

### 4. Start the Server  

npm run dev  

### API Endpoints  

#### Auth  

POST /api/login  

POST /api/register  

#### Profile  

GET /api/profile/teams  

POST /api/profile/teams  

DELETE /api/profile/teams/:id  

#### Comparisons  

GET /api/profile/comparisons  

POST /api/profile/comparisons  

DELETE /api/profile/comparisons/:id  
