const { Parser } = require("json2csv");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");

const app = express();
const PORT = 3000;

// Connect to MongoDB
if (process.env.NODE_ENV !== 'test') {
  // Only connect to the real database if not running tests
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
}
// Middleware
app.use(bodyParser.json());

// Routes will go here
const User = require("./models/User");
const Counter = require("./models/Counter");
const Expense = require("./models/Expense");

// Helper function to get the next serial ID
const getNextSerialId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { model: "User" }, // Identify the model
    { $inc: { count: 1 } }, // Increment the counter by 1
    { new: true, upsert: true } // Create the counter if it doesn't exist
  );
  return counter.count;
};

// Create a new user with a serial ID
app.post(
  "/users",
  [
    // Validation rules
    body("email").isEmail().withMessage("Invalid email format"),
    body("name").not().isEmpty().withMessage("Name is required"),
    body("mobile").isMobilePhone().withMessage("Invalid mobile phone number"),
  ],
  async (req, res) => {
    //const { name, email, mobile } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Get the next serial ID
      const { email, name, mobile } = req.body;
      const serialId = await getNextSerialId();

      // Create and save the user
      const user = new User({ name, email, mobile, serialId });
      await user.save();

      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

// Retrieve user details
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Add a new expense
app.post("/expenses", [
  // Validation rules
  body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
  body('createdBy').not().isEmpty().withMessage('Expense creator is required'),
  body('participants').isArray().withMessage('Participants should be an array'),
  body('participants.*.user').not().isEmpty().withMessage('Each participant must have a user ID'),
  body('participants.*.percentageOwed')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Percentage must be between 0 and 100')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { totalAmount, createdBy, participants,splitMethod } = req.body;

    // Validate participants
    // Fetch all participants' details from the database
    const participantIds = participants.map((p) => p.user);
    const users = await User.find({ _id: { $in: participantIds } });

    // Check if all participants exist
    if (users.length !== participantIds.length) {
      return res
        .status(400)
        .json({ message: "One or more participants do not exist" });
    }

    participants.forEach((participant) => {
      participant.amountOwed = 0; // Initialize amountOwed to 0 for each participant
    });

    if (splitMethod === "equal") {
      const numParticipants = participants.length;
      const equalShare = totalAmount / numParticipants;

      participants.forEach((participant) => {
        participant.amountOwed = equalShare; // Assign equal share to each participant
        delete participant.percentageOwed; // Remove percentageOwed field if it exists
      });
    } else if (splitMethod === "percentage") {
      const totalPercentage = participants.reduce(
        (sum, p) => sum + p.percentageOwed,
        0
      );
      if (totalPercentage !== 100) {
        return res
          .status(400)
          .json({ message: "Percentages must add up to 100%" });
      }

      participants.forEach((participant) => {
        participant.amountOwed =
          (totalAmount * participant.percentageOwed) / 100; // Calculate owed amount based on percentage
      });
    } participants.forEach((participant) => {
      participant.amountOwed = parseFloat(participant.amountOwed); // Convert to number
    });

    // Validation for the "exact" split method
    if (splitMethod === "exact") {
      const totalOwed = participants.reduce((sum, p) => sum + p.amount, 0);

      if (totalOwed !== totalAmount) {
        return res.status(400).json({
          message: "Amounts must add up to total expense", totalOwed, totalAmount
        });
      }

      participants.forEach((participant) => {
        participant.amountOwed = parseFloat(participant.amount); // Convert to number
      });
    }

    const expense = new Expense({
      totalAmount,
      createdBy,
      participants,
      splitMethod,
    });


    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    console.error("Error updating user expenses:", error); // Log any errors for debugging
    res.status(400).json({ message: error.message });
  }
});


//Individual expense of the user
app.get("/expenses/:userId", async (req, res) => {
  try {
    // Find expenses created by the user
    const expenses = await Expense.find({
      createdBy: req.params.userId, // Query directly on createdBy
    }).populate("createdBy"); // Populate the createdBy field

    // Check if expenses were found
    if (expenses.length === 0) {
      return res
        .status(404)
        .json({ message: "No expenses found for this user." });
    }

    res.json(expenses);
  } catch (error) {
    console.error("Error retrieving expenses:", error);
    res.status(500).json({ message: error.message });
  }
});

app.get("/overall_expenses/:userId", async (req, res) => {
  try {
    // Retrieve expenses with populated participants and createdBy
    const expenses = await Expense.find({
      "participants.user": req.params.userId,
    })
      .populate("participants.user", "name") // Populate participants with their name
      .populate("createdBy", "name"); // Populate createdBy with their name

    let totalOwed = 0;
    let totalPaid = 0;

    // Create a list to store individual expense details
    const expenseDetails = expenses.map((expense) => {
      const participant = expense.participants.find(
        (p) => p.user._id.toString() === req.params.userId
      );

      // Add the amount owed to totalOwed if the participant exists
      if (participant) {
        totalOwed += participant.amountOwed;
      }

      // Increment totalPaid if the current user is the creator of the expense
      if (expense.createdBy._id.toString() === req.params.userId) {
        totalPaid += expense.totalAmount;
      }

      return {
        expenseId: expense._id,
        totalAmount: expense.totalAmount,
        paidBy: {
          userId: expense.createdBy._id,
          name: expense.createdBy.name,
        },
        participants: expense.participants.map((participant) => ({
          userId: participant.user._id,
          name: participant.user.name,
          amountOwed: participant.amountOwed,
        })),
      };
    });

    // Calculate balance
    const balance = totalOwed- totalPaid;

    // Return a single response object

    const balanceSheet = {
      totalOwed,
      totalPaid,
      balance,
      expenses: expenseDetails, // Include detailed expenses
    };

    // Check if request includes the download query parameter
    if (req.query.download) {
      const csv = new Parser().parse(balanceSheet);
      res.header("Content-Type", "text/csv");
      res.attachment("balance_sheet.csv");
      return res.send(csv);
    }
    res.json({
      balanceSheet,
    });
  } catch (error) {
    console.error("Error retrieving balance sheet:", error);
    res.status(500).json({ message: error.message });
  }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app
