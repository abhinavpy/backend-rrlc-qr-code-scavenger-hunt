const mongoose = require('mongoose');
const crypto = require('crypto');

const ClassSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a class name']
  },
  teacher: {
    _id: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    name: String,
    email: String
  },
  classCode: {
    type: String,
    unique: true
  },
  school: {
    type: String,
    required: [true, 'Please add a school name']
  },
  grade: {
    type: String,
    required: [true, 'Please add a grade level']
  },
  studentCount: {
    type: Number,
    required: [true, 'Please add the number of students']
  },
  classPicture: {
    type: String,
    default: null
  },
  description: {
    type: String,
    maxlength: [300, 'Description cannot exceed 300 characters']
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // --- Fields required by adminController ---
  stationsScanned: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station'
  }],
  isCompleted: {
    type: Boolean,
    default: false
  },
  lastScanAt: {
    type: Date
  },
  completedAt: {
    type: Date
  }
  // --- End of added fields ---
});

// Generate a unique class code before saving
ClassSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate a 6-character alphanumeric code
    this.classCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Class', ClassSchema);