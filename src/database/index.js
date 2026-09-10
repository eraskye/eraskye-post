const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function ensureFile(filePath, defaultValue) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

const usersFile = path.join(dataDir, 'users.json');
const postsFile = path.join(dataDir, 'posts.json');
const commentsFile = path.join(dataDir, 'comments.json');

function resetData() {
  ensureFile(usersFile, []);
  ensureFile(postsFile, []);
  ensureFile(commentsFile, []);
  writeJson(usersFile, []);
  writeJson(postsFile, []);
  writeJson(commentsFile, []);
}

resetData();

function getUsers() {
  return readJson(usersFile, []);
}

function getPosts() {
  return readJson(postsFile, []);
}

function getComments() {
  return readJson(commentsFile, []);
}

function saveUsers(users) {
  writeJson(usersFile, users);
}

function savePosts(posts) {
  writeJson(postsFile, posts);
}

function saveComments(comments) {
  writeJson(commentsFile, comments);
}

module.exports = {
  getUsers,
  getPosts,
  getComments,
  saveUsers,
  savePosts,
  saveComments,
  dataDir,
  resetData,
};
