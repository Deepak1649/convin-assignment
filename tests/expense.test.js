const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const Expense = require('../models/Expense');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  // Close the Express server
  await new Promise(resolve => app.listen().close(resolve));
});

beforeEach(async () => {
  await User.deleteMany({});
  await Expense.deleteMany({});
});

describe('User API Endpoints', () => {
  describe('POST /users', () => {
    it('should create a new user', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        mobile: '+919876543210' // Using a valid format for mobile number
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(201);

      expect(response.body.name).toBe(userData.name);
      expect(response.body.email).toBe(userData.email);
      expect(response.body.serialId).toBeDefined();
    });

    it('should validate user input', async () => {
      const invalidUser = {
        name: '',
        email: 'invalid-email',
        mobile: 'invalid-phone'
      };

      const response = await request(app)
        .post('/users')
        .send(invalidUser)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /users/:id', () => {
    it('should retrieve user details', async () => {
      const user = new User({
        name: 'Jane Doe',
        email: 'jane@example.com',
        mobile: '+1234567890',
        serialId: 1
      });
      await user.save();

      const response = await request(app)
        .get(`/users/${user._id}`)
        .expect(200);

      expect(response.body.name).toBe(user.name);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/users/${fakeId}`)
        .expect(404);
    });
  });
});

describe('Expense API Endpoints', () => {
  let user1, user2, user3;

  beforeEach(async () => {
    user1 = await new User({
      name: 'User 1',
      email: 'user1@example.com',
      mobile: '+1234567891',
      serialId: 1
    }).save();

    user2 = await new User({
      name: 'User 2',
      email: 'user2@example.com',
      mobile: '+1234567892',
      serialId: 2
    }).save();

    user3 = await new User({
      name: 'User 3',
      email: 'user3@example.com',
      mobile: '+1234567893',
      serialId: 3
    }).save();
  });

  describe('POST /expenses', () => {
    it('should create an expense with equal split', async () => {
      const expenseData = {
        totalAmount: 300,
        createdBy: user1._id,
        splitMethod: 'equal',
        participants: [
          { user: user1._id },
          { user: user2._id },
          { user: user3._id }
        ]
      };

      const response = await request(app)
        .post('/expenses')
        .send(expenseData)
        .expect(201);

      expect(response.body.totalAmount).toBe(300);
      expect(response.body.participants).toHaveLength(3);
      expect(response.body.participants[0].amountOwed).toBe(100);
    });

    it('should create an expense with percentage split', async () => {
      const expenseData = {
        totalAmount: 1000,
        createdBy: user1._id,
        splitMethod: 'percentage',
        participants: [
          { user: user1._id, percentageOwed: 50 },
          { user: user2._id, percentageOwed: 30 },
          { user: user3._id, percentageOwed: 20 }
        ]
      };

      const response = await request(app)
        .post('/expenses')
        .send(expenseData)
        .expect(201);

      expect(response.body.participants[0].amountOwed).toBe(500);
      expect(response.body.participants[1].amountOwed).toBe(300);
      expect(response.body.participants[2].amountOwed).toBe(200);
    });

    it('should create an expense with exact split', async () => {
      const expenseData = {
        totalAmount: 1000,
        createdBy: user1._id,
        splitMethod: 'exact',
        participants: [
          { user: user1._id, amount: 500 },
          { user: user2._id, amount: 300 },
          { user: user3._id, amount: 200 }
        ]
      };

      const response = await request(app)
        .post('/expenses')
        .send(expenseData)
        .expect(201);

      expect(response.body.participants[0].amountOwed).toBe(500);
      expect(response.body.participants[1].amountOwed).toBe(300);
      expect(response.body.participants[2].amountOwed).toBe(200);
    });
  });

  describe('GET /expenses/:userId', () => {
    it('should get expenses created by user', async () => {
      const expense = await new Expense({
        totalAmount: 300,
        createdBy: user1._id,
        splitMethod: 'equal',
        participants: [
          { user: user1._id, amountOwed: 100 },
          { user: user2._id, amountOwed: 100 },
          { user: user3._id, amountOwed: 100 }
        ]
      }).save();

      const response = await request(app)
        .get(`/expenses/${user1._id}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].totalAmount).toBe(300);
    });
  });

  describe('GET /overall_expenses/:userId', () => {
    it('should calculate correct balance sheet', async () => {
      // Create an expense where user1 paid
      await new Expense({
        totalAmount: 300,
        createdBy: user1._id,
        splitMethod: 'equal',
        participants: [
          { user: user1._id, amountOwed: 100 },
          { user: user2._id, amountOwed: 100 },
          { user: user3._id, amountOwed: 100 }
        ]
      }).save();

      // Create an expense where user2 paid
      await new Expense({
        totalAmount: 150,
        createdBy: user2._id,
        splitMethod: 'equal',
        participants: [
          { user: user1._id, amountOwed: 50 },
          { user: user2._id, amountOwed: 50 },
          { user: user3._id, amountOwed: 50 }
        ]
      }).save();

      const response = await request(app)
        .get(`/overall_expenses/${user1._id}`)
        .expect(200);

      expect(response.body.balanceSheet.totalOwed).toBe(150); // 100 + 50
      expect(response.body.balanceSheet.totalPaid).toBe(300); // First expense
      expect(response.body.balanceSheet.balance).toBe(-150); // totalOwed - totalPaid
    });
  });
});