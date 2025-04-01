const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // Импортируем UUID

// Создаем экземпляр приложения Express
const app = express();

// Middleware для парсинга JSON
app.use(bodyParser.json());

// Подключаемся к MongoDB
mongoose.connect('mongodb+srv://mahmudovnuriddin35:Q1AYNX0tVvsS3jeN@cluster0.ldeggo9.mongodb.net/user_profile_db?retryWrites=true&w=majority')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Завершаем процесс, если не удается подключиться к базе данных
  });


// Модель для user_profile
const userProfileSchema = new mongoose.Schema({
  user: {
    firstName: String,
    lastName: String,
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  messages: [{
    id: String,
    text: String,
    sender: String,
    receiver: String,
    date: Date,
  }],
  skills: [{
    id: String,
    name: String,
    level: String,
  }],
  experiences: [{
    id: String,
    company: String,
    position: String,
    startDate: Date,
    endDate: Date,
  }],
  education: [{
    id: String,
    name: String,
    level: String,
    startDate: Date,
    endDate: Date,
  }],
  portfolios: [{
    id: String,
    title: String,
    description: String,
    url: String,
  }],
  photos: [{
    id: String,
    url: String,
    uploadedAt: Date,
  }],
  role: [{
    role: String,
  }]
});


// Настроим хранилище для Multer
const storage = multer.diskStorage({
  destination: 'uploads/', // Папка для сохранения файлов
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // Получаем расширение файла
    const uniqueName = `${uuidv4()}${ext}`; // Генерация уникального имени файла
    cb(null, uniqueName);
  },
});

const upload = multer({ storage }); // Это будет работать только если multer корректно импортирован и настроен

// Маршрут для загрузки файлов
app.post('/upload', upload.single('url'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { username } = req.body;  // Получаем username из тела запроса

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  // Сохранение фото в массив photos в user_profiles
  const photos = {
    id: uuidv4(),
    url: `/uploads/${req.file.filename}`, // Сохраняем путь к файлу
    uploadedAt: new Date(),
  };

  // Находим пользователя по username и добавляем фото в его профиль
  const updatedUserProfile = await UserProfile.findOneAndUpdate(
    { 'user.username': username }, // Ищем пользователя по username
    { $push: { photos: photos } }, // Добавляем фото в массив photos
    { new: true } // Возвращаем обновленный профиль
  );

  if (!updatedUserProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Ответ с данными о загруженном файле
  res.json({
    message: 'File uploaded successfully',
    photos,
  });
});


// Модель UserProfile на основе схемы
const UserProfile = mongoose.model('UserProfile', userProfileSchema, 'user_profiles');

// Регистрация нового пользователя
app.post('/auth/register', async (req, res) => {
  const { username, firstName, lastName, password } = req.body;

  if (!username || !firstName || !lastName || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const newUser = new UserProfile({
      user: {
        username,
        firstName,
        lastName,
        password, // Сохраняем пароль как есть
      },
      role: {
        role: 'user', // По умолчанию у пользователя будет роль 'user'
      }
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (err) {
    console.log('Error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Логин пользователя
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // Находим пользователя в базе данных
    const user = await UserProfile.findOne({ 'user.username': username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Сравниваем введенный пароль с сохранённым паролем
    if (password !== user.user.password) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Успешный вход
    res.status(200).json({ message: 'Login successful' });
  } catch (err) {
    console.log('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Маршрут для обновления данных пользователя
app.put('/auth/updatedetails', async (req, res) => {
  const { username, firstName, lastName } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Username обязательно для заполнения' });
  }

  try {
    // Находим пользователя по username
    const user = await UserProfile.findOne({ 'user.username': username });

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Обновляем только поля firstName, lastName и username
    if (firstName) user.user.firstName = firstName;
    if (lastName) user.user.lastName = lastName;
    if (username) user.user.username = username;

    // Сохраняем обновленные данные
    await user.save();

    // Отправляем успешный ответ
    res.status(200).json({ message: 'Данные пользователя обновлены успешно', user });
  } catch (err) {
    console.error('Ошибка:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});


// Маршрут для обновления пароля
app.put('/auth/updatepassword', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Username, current password, and new password are required' });
  }

  try {
    // Находим пользователя по username
    const user = await UserProfile.findOne({ 'user.username': username });

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Проверяем, совпадает ли текущий пароль
    if (currentPassword !== user.user.password) {
      return res.status(400).json({ message: 'Неверный текущий пароль' });
    }

    // Обновляем новый пароль
    user.user.password = newPassword;

    // Сохраняем обновленные данные
    await user.save();

    // Отправляем успешный ответ
    res.status(200).json({ message: 'Пароль успешно обновлен' });
  } catch (err) {
    console.error('Ошибка:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Маршрут для получения данных текущего пользователя
app.get('/auth/me', async (req, res) => {
  const { username } = req.query; // Получаем username из query параметра

  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  try {
    // Находим пользователя по username
    const user = await UserProfile.findOne({ 'user.username': username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Возвращаем всю информацию о пользователе
    res.status(200).json({
      user: {
        firstName: user.user.firstName,
        lastName: user.user.lastName,
        username: user.user.username,
        info: user.user.info || '',
        phoneNumber: user.user.phoneNumber || '',
        birthday: user.user.birthday || '',
        address: user.user.address || '',
        email: user.user.email || '',
        github: user.user.github || '',
        linkedin: user.user.linkedin || '',
        telegram: user.user.telegram || '',
        instagram: user.user.instagram || '',
        youtube: user.user.youtube || '',
        facebook: user.user.facebook || '',
        messages: user.messages,
        skills: user.skills,
        experiences: user.experiences,
        education: user.education,
        portfolios: user.portfolios,
        photos: user.photos
      }
    });
  } catch (err) {
    console.error('Ошибка:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Маршрут для удаления фото
app.delete('/auth/upload/:filename', async (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    return res.status(400).json({ message: 'Filename is required' });
  }

  try {
    // Находим пользователя, у которого есть фото с таким именем
    const user = await UserProfile.findOne({ 'photos.url': filename });

    if (!user) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Удаляем фото из массива photos
    user.photos = user.photos.filter(photo => photo.url !== filename);

    // Сохраняем обновленные данные пользователя
    await user.save();

    res.status(200).json({ message: 'Photo deleted successfully' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Маршрут для загрузки файла
app.post('/auth/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const user = await UserProfile.findOne({ 'user.username': username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Добавляем новое фото в базу данных
    user.photos.push({
      id: req.file.filename,
      url: req.file.path,
      uploadedAt: new Date(),
    });

    await user.save();
    res.status(200).json({ message: 'File uploaded successfully', file: req.file });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Маршрут для получения всех скилов, которые есть на сайте (из всех пользователей)
app.get('/skills', async (req, res) => {
  try {
    // Находим все скилы из всех пользователей
    const users = await UserProfile.find(); // Получаем всех пользователей

    // Извлекаем все скилы
    const allSkills = users.flatMap(user => user.skills);

    if (allSkills.length === 0) {
      return res.status(404).json({ message: 'No skills found' });
    }

    // Возвращаем все скилы
    res.status(200).json({
      skills: allSkills
    });
  } catch (err) {
    console.error('Ошибка:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});


// Маршрут для добавления скилла для пользователя
app.post('/skills', async (req, res) => {
  const { username, name, level } = req.body;

  if (!username || !name || !level) {
    return res.status(400).json({ message: 'Username, skill name, and skill level are required' });
  }

  try {
    // Находим пользователя по username
    const user = await UserProfile.findOne({ 'user.username': username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Создаем новый скилл
    const newSkill = {
      id: Date.now().toString(), // Генерация уникального ID скилла
      name,
      level
    };

    // Добавляем новый скилл в массив skills пользователя
    user.skills.push(newSkill);

    // Сохраняем обновленные данные пользователя
    await user.save();

    // Отправляем успешный ответ
    res.status(200).json({ message: 'Skill added successfully', skill: newSkill });
  } catch (err) {
    console.error('Ошибка:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/skills/:id', async (req, res) => {
  const { id } = req.params;  // Получаем строковый ID скилла
  const { name, level } = req.body;  // Данные для обновления

  if (!name && !level) {
    return res.status(400).json({ message: 'At least name or level is required to update the skill' });
  }

  try {
    // Находим пользователя, у которого есть этот скилл
    const user = await UserProfile.findOne({ 'skills.id': id });

    if (!user) {
      return res.status(404).json({ message: 'User or skill not found' });
    }

    // Находим нужный скилл
    const skill = user.skills.find(skill => skill.id === id);

    if (!skill) {
      return res.status(404).json({ message: 'Skill not found for this user' });
    }

    // Обновляем данные скилла
    if (name) skill.name = name;
    if (level) skill.level = level;

    // Сохраняем пользователя с обновленным скиллом
    await user.save();

    res.status(200).json({ message: 'Skill updated successfully', skill });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});


app.get('/skills/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Ищем пользователя, у которого есть этот скилл
    const user = await UserProfile.findOne({ 'skills.id': id });

    if (!user) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    // Ищем сам скилл
    const skill = user.skills.find(skill => skill.id === id);

    if (!skill) {
      return res.status(404).json({ message: 'Skill not found for this user' });
    }

    res.status(200).json(skill);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});


app.delete('/skills/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Ищем пользователя, у которого есть этот скилл
    const user = await UserProfile.findOne({ 'skills.id': id });

    if (!user) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    // Фильтруем массив, удаляя нужный скилл
    user.skills = user.skills.filter(skill => skill.id !== id);

    // Сохраняем изменения
    await user.save();

    res.status(200).json({ message: 'Skill deleted successfully' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/experiences', async (req, res) => {
  try {
    const user = await UserProfile.findOne(); // Или фильтр по пользователю, если нужно
    if (!user || !user.experiences) {
      return res.status(404).json({ message: 'No experiences found' });
    }
    res.status(200).json(user.experiences);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/experiences', async (req, res) => {
  const { id, title, company, years } = req.body;

  if (!id || !title || !company || !years) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const user = await UserProfile.findOne(); // Найти пользователя (добавь фильтр, если нужно)
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Добавляем новый опыт в массив
    user.experiences.push({ id, title, company, years });
    await user.save();

    res.status(201).json({ message: 'Experience added successfully', experiences: user.experiences });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/experiences/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await UserProfile.findOne({ 'experiences.id': id });

    if (!user) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    const experience = user.experiences.find(exp => exp.id === id);

    if (!experience) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    res.status(200).json(experience);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/experiences/:id', async (req, res) => {
  const { id } = req.params;  // Получаем id из параметров URL

  try {
    const user = await UserProfile.findOne({ 'experiences.id': id });

    if (!user) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    // Удаляем нужный опыт
    user.experiences = user.experiences.filter(exp => exp.id !== id);

    // Сохраняем изменения
    await user.save();

    res.status(200).json({ message: 'Experience deleted successfully' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/experiences/:id', async (req, res) => {
  const { id } = req.params;
  const { company, position, startDate, endDate } = req.body;

  // Проверяем, что все поля присутствуют
  if (!company || !position || !startDate || !endDate) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Ищем пользователя, у которого есть этот опыт
    const user = await UserProfile.findOne({ 'experiences.id': id });

    if (!user) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    // Ищем нужный опыт по `id`
    const experience = user.experiences.find(exp => exp.id === id);

    if (!experience) {
      return res.status(404).json({ message: 'Experience not found for this user' });
    }

    // Обновляем данные
    experience.company = company;
    experience.position = position;
    experience.startDate = startDate;
    experience.endDate = endDate;

    // Сохраняем изменения в базе
    await user.save();

    res.status(200).json({ message: 'Experience updated successfully', experience });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/education', async (req, res) => {
  try {
    const user = await UserProfile.findOne(); // Предполагаем, что у тебя один профиль пользователя

    if (!user || !user.education) {
      return res.status(404).json({ message: 'No education records found' });
    }

    res.status(200).json(user.education);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/education', async (req, res) => {
  const { name, level, startDate, endDate } = req.body;

  if (!name || !level || !startDate || !endDate) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const user = await UserProfile.findOne();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newEducation = { id: uuidv4(), name, level, startDate, endDate };

    user.education.push(newEducation);
    await user.save();

    res.status(201).json({ message: 'Education added successfully', education: newEducation });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/education/:id', async (req, res) => {
  const { id } = req.params;
  const user = await UserProfile.findOne({ 'education.id': id });

  if (!user) {
    return res.status(404).json({ message: 'Education not found' });
  }

  const education = user.education.find(ed => ed.id === id);
  res.status(200).json(education);
});

app.delete('/education/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await UserProfile.findOne({ 'education.id': id });

    if (!user) {
      return res.status(404).json({ message: 'Education not found' });
    }

    user.education = user.education.filter(ed => ed.id !== id);
    await user.save();

    res.status(200).json({ message: 'Education deleted successfully' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/education/:id', async (req, res) => {
  const { id } = req.params;
  const { name, level, startDate, endDate } = req.body;

  if (!name && !level && !startDate && !endDate) {
    return res.status(400).json({ message: 'At least one field is required for update' });
  }

  try {
    const user = await UserProfile.findOne({ 'education.id': id });

    if (!user) {
      return res.status(404).json({ message: 'Education not found' });
    }

    // Найти нужное образование и обновить
    const education = user.education.find(ed => ed.id === id);
    if (!education) {
      return res.status(404).json({ message: 'Education not found for this user' });
    }

    if (name) education.name = name;
    if (level) education.level = level;
    if (startDate) education.startDate = startDate;
    if (endDate) education.endDate = endDate;

    await user.save();

    res.status(200).json({ message: 'Education updated successfully', education });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/portfolios', async (req, res) => {
  try {
    const user = await UserProfile.findOne();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ portfolios: user.portfolios });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/portfolios', async (req, res) => {
  const { title, url, description } = req.body;

  if (!title || !url || !description) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const user = await UserProfile.findOne();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newPortfolio = { id: uuidv4(), title, url, description };
    user.portfolios.push(newPortfolio);
    await user.save();

    res.status(201).json({ message: 'Portfolio added successfully', portfolio: newPortfolio });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/portfolios/:id', async (req, res) => {
  const { id } = req.params;
  const { title, url, description } = req.body;

  if (!title && !url && !description) {
    return res.status(400).json({ message: 'At least one field (title, url, description) is required to update the portfolio' });
  }

  try {
    const user = await UserProfile.findOne();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ищем проект в массиве портфолио
    const portfolio = user.portfolios.find(p => p.id === id);

    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    // Обновляем поля, если они переданы
    if (title) portfolio.title = title;
    if (url) portfolio.url = url;
    if (description) portfolio.description = description;

    await user.save();

    res.status(200).json({ message: 'Portfolio updated successfully', portfolio });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/portfolios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserProfile.findOne({ 'portfolios.id': id });

    if (!user) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    const portfolio = user.portfolios.find(p => p.id === id);
    res.json(portfolio);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/portfolios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserProfile.findOne({ 'portfolios.id': id });

    if (!user) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    // Удаляем портфолио из массива
    user.portfolios = user.portfolios.filter(p => p.id !== id);
    await user.save();

    res.json({ message: 'Portfolio deleted successfully' });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/upload/:photoId', async (req, res) => {
  const { photoId } = req.params;

  const updatedUserProfile = await UserProfile.findOneAndUpdate(
    { 'photos.id': photoId },
    { $pull: { photos: { id: photoId } } },
    { new: true }
  );

  if (!updatedUserProfile) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  res.json({ message: 'Photo deleted successfully' });
});

app.get('/upload/:photoId', async (req, res) => {
  const { photoId } = req.params;

  const user = await UserProfile.findOne({ 'photos.id': photoId }, { 'photos.$': 1 });

  if (!user || !user.photos.length) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  res.json({ photo: user.photos[0] });
});

app.get('/users', async (req, res) => {
  const users = await UserProfile.find({}, { 'user.password': 0 }); // Исключаем поле пароля
  res.json(users);
});

app.get('/users', async (req, res) => {
  const { role } = req.query;

  const filter = role ? { 'user.role': role } : {}; // Фильтр по роли, если передан параметр

  const users = await UserProfile.find(filter, { 'user.password': 0 }); // Исключаем пароль
  res.json(users);
});

app.get('/users', async (req, res) => {
  const { role } = req.query;

  // Формируем фильтр: если передана роль, ищем только по ней, иначе возвращаем всех
  const filter = role ? { 'role.role': role } : {};

  try {
    const users = await UserProfile.find(filter, { 'user.password': 0 }); // Исключаем пароль
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/users', async (req, res) => {
  const { firstName, lastName, username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const newUser = new UserProfile({
      user: { firstName, lastName, username, password },
      role: { role: 'user' }
    });

    await newUser.save();
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await UserProfile.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await UserProfile.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/users/:id', async (req, res) => {
  try {
    const updatedUser = await UserProfile.findByIdAndUpdate(
      req.params.id,
      {
        'user.firstName': req.body.firstName,
        'user.lastName': req.body.lastName,
        'user.username': req.body.username
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Error during user update:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put('/users/:id', async (req, res) => {
  const { role } = req.body; // Получаем роль из запроса

  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  try {
    // Обновление пользователя по ID
    const updatedUser = await UserProfile.findByIdAndUpdate(
      req.params.id,
      { $set: { role } }, // Обновляем только поле role
      { new: true, runValidators: true } // Возвращаем обновленного пользователя
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Задаем порт для сервера
const port = process.env.PORT || 5000;

// Запуск сервера на порту 5000
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});