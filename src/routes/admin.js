const express = require('express');
const { listUsers, listPosts, listComments } = require('../services/socialService');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  const users = listUsers();
  const posts = listPosts();
  const comments = listComments();

  res.json({
    stats: {
      users: users.length,
      posts: posts.length,
      comments: comments.length,
    },
    users: users.slice(0, 10),
    posts: posts.slice(0, 10),
    comments: comments.slice(0, 10),
  });
});

module.exports = router;
