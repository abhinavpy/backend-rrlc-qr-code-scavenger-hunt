const mongoose = require('mongoose');
const crypto = require('crypto');

const StationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a station name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  qrCode: {
    type: String,
    unique: true
  },
  educationalInfo: {
    type: String,
    maxlength: [2000, 'Educational info cannot be more than 2000 characters']
  },
  // New fields for enhanced educational content
  imageUrl: {
    type: String,
    trim: true
  },
  funFacts: [{
    type: String,
    maxlength: [300, 'Fun fact cannot be more than 300 characters']
  }],
  safetyTips: [{
    type: String,
    maxlength: [300, 'Safety tip cannot be more than 300 characters']
  }],
  ageGroup: {
    type: String,
    enum: ['Elementary (K-5)', 'Middle School (6-8)', 'High School (9-12)', 'All Ages'],
    default: 'All Ages'
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Easy'
  },
  estimatedTime: {
    type: Number, // in minutes
    min: [1, 'Estimated time must be at least 1 minute'],
    max: [60, 'Estimated time cannot exceed 60 minutes']
  },
  learningObjectives: [{
    type: String,
    maxlength: [200, 'Learning objective cannot be more than 200 characters']
  }],
  equipment: [{
    type: String,
    maxlength: [100, 'Equipment item cannot be more than 100 characters']
  }],
  activityType: {
    type: String,
    enum: ['Interactive Demo', 'Hands-on Activity', 'Information Display', 'Q&A Session', 'Competition/Game'],
    default: 'Information Display'
  },
  staffRequired: {
    type: Number,
    min: [0, 'Staff required cannot be negative'],
    default: 1
  },
  maxParticipants: {
    type: Number,
    min: [1, 'Max participants must be at least 1'],
    default: 30
  },
  weatherDependent: {
    type: Boolean,
    default: false
  },
  location: {
    type: String,
    maxlength: [100, 'Location cannot be more than 100 characters']
  },
  order: {
    type: Number
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
StationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  if (this.isNew) {
    // Generate a unique identifier for this station
    this.qrCode = crypto.randomBytes(8).toString('hex');
  }
  next();
});

module.exports = mongoose.model('Station', StationSchema);