const mongoose = require('mongoose');

const DrawingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a drawing name'],
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  eligibleClasses: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Class'
  }],
  winners: [{
    class: {
      type: mongoose.Schema.ObjectId,
      ref: 'Class'
    },
    prize: {
      type: String
    },
    notified: {
      type: Boolean,
      default: false
    }
  }],
  weightingFactors: {
    completionTime: {
      type: Number,
      default: 1
    },
    stationsFound: {
      type: Number,
      default: 1
    }
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
});

module.exports = mongoose.model('Drawing', DrawingSchema);