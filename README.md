# Expense Sharing Application

A Node.js-based REST API for managing shared expenses among users. This application allows users to create expenses, split them among multiple participants using different splitting methods (equal, percentage, or exact), and track balances.

## Features

- User Management
  - Create users with name, email, and mobile number
  - Retrieve user details
  - Auto-generated serial IDs for users

- Expense Management
  - Create expenses with multiple participants
  - Support for different splitting methods:
    - Equal split
    - Percentage-based split
    - Exact amount split
  - Track expenses per user
  - Generate balance sheets
  - Export expense reports to CSV

## Technology Stack

- Node.js
- Express.js
- MongoDB
- Jest (Testing)
- Mongoose (ODM)

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/expense-sharing-app.git
cd expense-sharing-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
MONGO_URI=mongodb://localhost:27017/expense-sharing
PORT=3000
```

4. Start the server:
```bash
npm start
```

## Testing

Run the test suite:
```bash
npm test
```

## API Documentation

### User Endpoints

#### Create User
```http
POST /users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "mobile": "+919876543210"
}
```

#### Get User Details
```http
GET /users/:id
```

### Expense Endpoints

#### Create Expense
```http
POST /expenses
Content-Type: application/json

{
  "totalAmount": 1000,
  "createdBy": "userId",
  "splitMethod": "equal",
  "participants": [
    {"user": "userId1"},
    {"user": "userId2"},
    {"user": "userId3"}
  ]
}
```

For percentage split:
```json
{
  "totalAmount": 1000,
  "createdBy": "userId",
  "splitMethod": "percentage",
  "participants": [
    {"user": "userId1", "percentageOwed": 50},
    {"user": "userId2", "percentageOwed": 30},
    {"user": "userId3", "percentageOwed": 20}
  ]
}
```

For exact split:
```json
{
  "totalAmount": 1000,
  "createdBy": "userId",
  "splitMethod": "exact",
  "participants": [
    {"user": "userId1", "amount": 500},
    {"user": "userId2", "amount": 300},
    {"user": "userId3", "amount": 200}
  ]
}
```

#### Get User Expenses
```http
GET /expenses/:userId
```

#### Get Overall Balance Sheet
```http
GET /overall_expenses/:userId
```

For CSV export:
```http
GET /overall_expenses/:userId?download=true
```

## Project Structure

```
expense-sharing-app/
├── models/
│   ├── User.js
│   ├── Expense.js
│   └── Counter.js
├── tests/
│   └── expense.test.js
├── server.js
├── package.json
├── README.md
└── .env
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License.
