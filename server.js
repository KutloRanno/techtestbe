const express = require("express");
const multer = require("multer");
const cors = require("cors");
const mime = require("mime-types");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json()); // Add this to parse JSON bodies

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use custom name if provided, otherwise generate one
    const customName = req.body.customNames?.[file.fieldname];
    const safeName = customName
      ? customName.replace(/[^a-z0-9.-]/gi, "_").toLowerCase()
      : Date.now();

    // Preserve original extension
    const ext = path.extname(file.originalname);
    cb(null, `${safeName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// File upload endpoint
app.post("/upload", upload.array("files"), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const fileUrls = req.files.map((file) => ({
      originalName: file.originalname,
      storedName: file.filename,
      path: file.path,
      size: file.size,
      type: file.mimetype,
    }));

    res.json({
      message: "Files uploaded successfully",
      files: fileUrls,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error uploading files" });
  }
});

// Get list of uploaded files
app.get("/files", (req, res) => {
  const uploadDir = "uploads/";

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ message: "Error reading files" });
    }

    const fileDetails = files.map((file) => {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);

      return {
        name: file,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    });

    res.json(fileDetails);
  });
});

app.get("/files/image/:filename", (req, res) => {
  const filePath = path.join("uploads", req.params.filename);

  if (fs.existsSync(filePath)) {
    // Check if file is an image
    const mimeType = mime.lookup(filePath);
    if (mimeType && mimeType.startsWith("image/")) {
      res.setHeader("Content-Type", mimeType);
      res.sendFile(path.resolve(filePath));
    } else {
      res.status(400).json({ message: "Requested file is not an image" });
    }
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

// Download a file
app.get("/files/:filename", (req, res) => {
  const filePath = path.join("uploads", req.params.filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

// Rename a file
app.put("/files/rename", (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res
        .status(400)
        .json({ message: "Both oldName and newName are required" });
    }

    const oldPath = path.join("uploads", oldName);
    const newPath = path.join("uploads", newName);

    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ message: "File not found" });
    }

    if (fs.existsSync(newPath)) {
      return res
        .status(400)
        .json({ message: "A file with that name already exists" });
    }

    fs.renameSync(oldPath, newPath);
    res.json({ message: "File renamed successfully", oldName, newName });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error renaming file" });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
