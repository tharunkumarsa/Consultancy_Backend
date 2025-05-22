const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/billing", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

// Product Schema
const productSchema = new mongoose.Schema({
  product_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String },
  price: { type: Number, required: true },
  purchasePrice: { type: Number, default: 0 }, // ✅ NEW FIELD
  quantity: { type: Number, required: true },
  rack: { type: String },
});

const Product = mongoose.model("Product", productSchema);

// Purchase Schema
const purchaseSchema = new mongoose.Schema({
  customer: {
    name: String,
    place: String,
    phone: String,
    address: String,
  },
  products: Array,
  total: Number,
  date: { type: Date, default: Date.now },
});

const Purchase = mongoose.model("Purchase", purchaseSchema);

// ➕ Signup new user
app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const newUser = new User({ username, email, password, phone });
    await newUser.save();
    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    console.error("❌ Error signing up:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// 🔒 Login user
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    res.status(200).json({ message: "Login successful" });
  } catch (err) {
    console.error("❌ Error logging in:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// 📄 Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 });
    res.status(200).json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch user details" });
  }
});

// ❌ Delete product by MongoDB _id
app.delete("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ➕ Add product
app.post("/api/products", async (req, res) => {
  try {
    const { product_id, name, type, price, purchasePrice , quantity, rack } = req.body;

    const newProduct = new Product({
      product_id,
      name,
      type,
      price,
      purchasePrice,
      quantity,
      rack,
    });

    await newProduct.save();
    res.status(201).json({ message: "Product added successfully" });
  } catch (err) {
    console.error("❌ Error adding product:", err);
    res.status(500).json({ error: "Failed to add product" });
  }
});

// 📄 Get all products
app.get("/api/products", async (req, res) => {
  try {
    const allProducts = await Product.find();
    res.status(200).json(allProducts);
  } catch (err) {
    console.error("❌ Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// 📄 Get all purchases
app.get('/api/purchases', async (req, res) => {
  try {
    const purchases = await Purchase.find();
    res.status(200).json(purchases);
  } catch (err) {
    console.error("Error fetching purchases:", err);
    res.status(500).json({ message: "Error fetching purchase history" });
  }
});

// ✏️ Update product by MongoDB _id
app.put("/api/products/update/:id", async (req, res) => {
  const { quantity, name, price, purchasePrice = 0, type, rack } = req.body;

  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { quantity, name, price, purchasePrice, type, rack },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
  } catch (err) {
    console.error("❌ Error updating product:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// 🔄 Update product quantity after billing by product_id
app.put("/api/products/:id", async (req, res) => {
  const { quantityToReduce } = req.body;

  try {
    const product = await Product.findOne({ product_id: req.params.id });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.quantity < quantityToReduce) {
      return res.status(400).json({ error: "Insufficient quantity" });
    }

    product.quantity -= quantityToReduce;
    await product.save();

    res.status(200).json({ message: "Quantity updated successfully" });
  } catch (err) {
    console.error("❌ Error updating quantity:", err);
    res.status(500).json({ error: "Failed to update quantity" });
  }
});

// ❌ Optional: Delete product by product_id
app.delete("/api/products/:id", async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({ product_id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json({ message: "Product removed successfully" });
  } catch (err) {
    console.error("❌ Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// 💾 Save purchase (billing)
app.post("/api/purchases", async (req, res) => {
  try {
    const newPurchase = new Purchase(req.body);
    await newPurchase.save();
    res.status(201).json({ message: "Purchase saved successfully" });
  } catch (err) {
    console.error("❌ Error saving purchase:", err);
    res.status(500).json({ error: "Failed to save purchase" });
  }
});

// Server start
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
