const { getUsers, getPosts, getComments, saveUsers, savePosts, saveComments } = require('../database');

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function listUsers() {
  return getUsers();
}

function listPosts() {
  return getPosts();
}

function listComments() {
  return getComments();
}

function createUser({ username, email, fullName }) {
  const users = getUsers();
  const exists = users.some((u) => u.username === username || u.email === email);
  if (exists) {
    throw new Error('User already exists');
  }

  const user = {
    id: makeId('user'),
    username,
    email,
    fullName,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);
  return user;
}

function createPost({ authorId, content, title }) {
  const posts = getPosts();
  const users = getUsers();
  const author = users.find((u) => u.id === authorId);
  if (!author) {
    throw new Error('Author not found');
  }

  const post = {
    id: makeId('post'),
    title: title || 'Untitled post',
    content,
    authorId,
    authorUsername: author.username,
    createdAt: new Date().toISOString(),
  };

  posts.unshift(post);
  savePosts(posts);
  return post;
}

function createComment({ authorId, postId, content }) {
  const comments = getComments();
  const users = getUsers();
  const author = users.find((u) => u.id === authorId);
  if (!author) {
    throw new Error('Author not found');
  }

  const comment = {
    id: makeId('comment'),
    authorId,
    authorUsername: author.username,
    postId,
    content,
    createdAt: new Date().toISOString(),
  };

  comments.push(comment);
  saveComments(comments);
  return comment;
}

function findPostById(postId) {
  return getPosts().find((post) => post.id === postId);
}

function findUserById(userId) {
  return getUsers().find((user) => user.id === userId);
}

module.exports = {
  listUsers,
  listPosts,
  listComments,
  createUser,
  createPost,
  createComment,
  findPostById,
  findUserById,
};
