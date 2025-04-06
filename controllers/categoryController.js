const Category = require('../models/categoryModel');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const slugify = require('slugify');

exports.getAllCategories = catchAsync(async (req, res, next) => {
  const categories = await Category.find({
    user: req.user.id,
  });

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: {
      categories,
    },
  });
});

exports.getCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findOne({
    user: req.user.id,
    _id: req.params.id,
  });

  if (!category) {
    return next(new AppError('No category found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      category,
    },
  });
});

exports.createCategory = catchAsync(async (req, res, next) => {
  const { name, type } = req.body;

  // check the category name is already exist

  const slug = slugify(name, { lower: true });

  const category = await Category.findOne({
    user: req.user.id,
    slug: slug,
  });

  if (category) {
    return next(new AppError('Category name already exist', 400));
  }

  const newCategory = await Category.create({
    name,
    type,
    user: req.user.id,
  });

  res.status(201).json({
    status: 'success',
    data: {
      category: newCategory,
    },
  });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  const { name, type } = req.body;

  // fetch excisting category
  const existingCategoey = await Category.findById(req.params.id);

  if (!existingCategoey) {
    return next(new AppError('No Category found that ID', 404));
  }

  // check the category name is changed
  if (name && name !== existingCategoey.name) {
    // check the slug is already exist
    const slug = slugify(name, { lower: true });

    const category = await Category.findOne({
      user: req.user.id,
      slug: slug,
    });

    if (category) {
      return next(new AppError('Category name already exist', 400));
    }
  }

  // update category
  existingCategoey.name = name;
  existingCategoey.type = type;
  existingCategoey.updatedAt = Date.now();

  await existingCategoey.save();

  res.status(200).json({
    status: 'success',
    data: {
      category: existingCategoey,
    },
  });
});

exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findByIdAndDelete(req.params.id);

  if (!category) {
    return next(new AppError('No Category found that ID', 404));
  }

  if (category.onTrack === true) {
    return next(new AppError('Cannot delete a category that is on track', 400));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
