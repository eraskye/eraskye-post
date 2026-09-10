const express = require('express');
const {
  listUsers,
  listPosts,
  listComments,
  createUser,
  createPost,
  createComment,
  findPostById,
  findUserById,
} = require('../services/socialService');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'ERASKYE', status: 'running' });
});

router.get('/users', (req, res) => {
  res.json(listUsers());
});

router.post('/users', (req, res) => {
  try {
    const { username, email, fullName } = req.body || {};
    if (!username || !email || !fullName) {
      return res.status(400).json({ error: 'username, email and fullName are required' });
    }
    const user = createUser({ username, email, fullName });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/posts', (req, res) => {
  const posts = listPosts();
  const comments = listComments();

  const enriched = posts.map((post) => ({
    ...post,
    comments: comments.filter((comment) => comment.postId === post.id),
  }));

  res.json(enriched);
});

router.post('/posts', (req, res) => {
  try {
    const { authorId, title, content } = req.body || {};
    if (!authorId || !content) {
      return res.status(400).json({ error: 'authorId and content are required' });
    }
    const post = createPost({ authorId, title, content });
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/posts/:postId', (req, res) => {
  const post = findPostById(req.params.postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const comments = listComments().filter((comment) => comment.postId === post.id);
  res.json({ ...post, comments });
});

router.post('/comments', (req, res) => {
  try {
    const { authorId, postId, content } = req.body || {};
    if (!authorId || !postId || !content) {
      return res.status(400).json({ error: 'authorId, postId and content are required' });
    }
    const comment = createComment({ authorId, postId, content });
    res.status(201).json(comment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/users/:userId', (req, res) => {
  const user = findUserById(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

module.exports = router;
