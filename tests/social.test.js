const test = require('node:test');
const assert = require('node:assert/strict');

const { resetData } = require('../src/database');
const { createUser, createPost, createComment, listPosts } = require('../src/services/socialService');

test.beforeEach(() => {
  resetData();
});

test('creates a user', () => {
  const user = createUser({ username: 'alice', email: 'alice@example.com', fullName: 'Alice Wonder' });
  assert.equal(user.username, 'alice');
  assert.equal(user.email, 'alice@example.com');
});

test('creates a post for a user', () => {
  const user = createUser({ username: 'bob', email: 'bob@example.com', fullName: 'Bob Builder' });
  const post = createPost({ authorId: user.id, content: 'Hello ERASKYE', title: 'Welcome' });
  assert.equal(post.authorUsername, 'bob');
  assert.equal(post.content, 'Hello ERASKYE');
});

test('creates a comment for a post', () => {
  const user = createUser({ username: 'charlie', email: 'charlie@example.com', fullName: 'Charlie Stone' });
  const post = createPost({ authorId: user.id, content: 'A post', title: 'Test' });
  const comment = createComment({ authorId: user.id, postId: post.id, content: 'Nice post' });
  assert.equal(comment.postId, post.id);
  assert.equal(comment.content, 'Nice post');
});

test('lists posts', () => {
  const posts = listPosts();
  assert.ok(Array.isArray(posts));
});
