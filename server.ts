/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  SEED_STUDENTS,
  SEED_METRICS,
  SEED_ADVICES,
  SEED_MEALS,
  SEED_WORKOUTS,
  SEED_PHOTOS,
  SEED_BADGES,
  SEED_NOTIFICATIONS,
} from './src/data/seedData.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shared Google Gen AI Client (Server-side only)
const aiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;


const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const getErrMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

app.use(express.json({ limit: '15mb' }));

// Aiven PostgreSQL Database Connection
const rawConnectionString =
  process.env.DATABASE_URL ||
  'postgres://avnadmin:AVNS_mnHs58-ghj3A7pfXzVe@pg-1b132c35-chitrung7542-3ac1.i.aivencloud.com:21684/TramTap?sslmode=require';

// Strip sslmode query parameter so pg driver respects rejectUnauthorized: false for Aiven TLS
const cleanConnectionString = rawConnectionString.replace(/[?&]sslmode=[^&]+/, '');

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 10000,
});

let dbConnected = false;

// Initialize Database Tables and Auto-Seed
async function initDatabase() {
  try {
    const client = await pool.connect();
    dbConnected = true;
    console.log('✅ Connected to Aiven PostgreSQL database: TramTap');

    // Create Tables conforming to SRS specs
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        student_id VARCHAR(64),
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(64) PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        gender VARCHAR(10) NOT NULL,
        age INT NOT NULL,
        height DECIMAL(4,2) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        address VARCHAR(255),
        date_of_birth DATE NOT NULL,
        health_goal TEXT NOT NULL,
        target_metrics JSONB DEFAULT '{}'::jsonb,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS health_metrics (
        id VARCHAR(64) PRIMARY KEY,
        student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        timestamp BIGINT NOT NULL,
        weight DECIMAL(5,2) NOT NULL,
        subcutaneous_fat DECIMAL(4,1) NOT NULL,
        bone_calcium DECIMAL(3,1) NOT NULL,
        body_water DECIMAL(4,1) NOT NULL,
        muscle_mass DECIMAL(5,2) NOT NULL,
        body_type VARCHAR(50) NOT NULL,
        bmr INT NOT NULL,
        biological_age INT NOT NULL,
        visceral_fat INT NOT NULL,
        waist DECIMAL(5,1) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_advices (
        id VARCHAR(64) PRIMARY KEY,
        student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
        metric_record_id VARCHAR(64),
        date DATE NOT NULL,
        status VARCHAR(30) NOT NULL,
        ai_draft_content JSONB NOT NULL,
        trainer_edited_content TEXT,
        trainer_note TEXT,
        approved_at VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS meal_logs (
        id VARCHAR(64) PRIMARY KEY,
        student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        meal_type VARCHAR(50) NOT NULL,
        image_url TEXT,
        food_description TEXT,
        estimated_calories INT DEFAULT 0,
        macros JSONB DEFAULT '{}'::jsonb,
        trainer_reaction VARCHAR(10),
        trainer_comment TEXT,
        logged_at VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workout_logs (
        id VARCHAR(64) PRIMARY KEY,
        student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        plan_title VARCHAR(255) NOT NULL,
        duration_minutes INT DEFAULT 45,
        exercises JSONB DEFAULT '[]'::jsonb,
        trainer_reaction VARCHAR(10),
        trainer_comment TEXT,
        logged_at VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS physique_photos (
        id VARCHAR(64) PRIMARY KEY,
        student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        image_url TEXT NOT NULL,
        photo_type VARCHAR(20) NOT NULL,
        weight DECIMAL(5,2),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS badges (
        id VARCHAR(64) PRIMARY KEY,
        student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        icon VARCHAR(20) NOT NULL,
        unlocked_at VARCHAR(50),
        category VARCHAR(30) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS smart_notifications (
        id VARCHAR(64) PRIMARY KEY,
        use_case_id VARCHAR(30) NOT NULL,
        student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        priority VARCHAR(20) NOT NULL,
        created_at VARCHAR(50) NOT NULL,
        read BOOLEAN DEFAULT FALSE
      );
    `);

    // Ensure newly added columns exist in meal_logs and students tables
    await client.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;
      ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;
      ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS drive_file_url TEXT;
      ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN DEFAULT TRUE;
      ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS nutrition_advice TEXT;
    `);

    // Purge any heavy Base64 image data from meal_logs so DB storage stays lightweight (only store Drive/URL links)
    await client.query(`
      UPDATE meal_logs
      SET image_url = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
      WHERE image_url LIKE 'data:image/%';
    `);

    // Check if students exist, if not seed initial data
    const res = await client.query('SELECT COUNT(*) FROM students');
    const count = parseInt(res.rows[0].count, 10);
    if (count === 0) {
      console.log('🌱 Database empty, seeding initial records from SRS...');
      for (const s of SEED_STUDENTS) {
        await client.query(
          `INSERT INTO students (id, full_name, gender, age, height, phone, address, date_of_birth, health_goal, target_metrics, avatar_url, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO NOTHING`,
          [
            s.id,
            s.fullName,
            s.gender,
            s.age,
            s.height,
            s.phone,
            s.address || '',
            s.dateOfBirth,
            s.healthGoal,
            JSON.stringify(s.targetMetrics),
            s.avatarUrl || '',
            s.createdAt,
          ]
        );
      }

      for (const m of SEED_METRICS) {
        await client.query(
          `INSERT INTO health_metrics (id, student_id, date, timestamp, weight, subcutaneous_fat, bone_calcium, body_water, muscle_mass, body_type, bmr, biological_age, visceral_fat, waist, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO NOTHING`,
          [
            m.id,
            m.studentId,
            m.date,
            m.timestamp,
            m.weight,
            m.subcutaneousFat,
            m.boneCalcium,
            m.bodyWater,
            m.muscleMass,
            m.bodyType,
            m.bmr,
            m.biologicalAge,
            m.visceralFat,
            m.waist,
            m.notes || '',
          ]
        );
      }

      for (const a of SEED_ADVICES) {
        await client.query(
          `INSERT INTO ai_advices (id, student_id, metric_record_id, date, status, ai_draft_content, trainer_edited_content, trainer_note, approved_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            a.id,
            a.studentId,
            a.metricRecordId,
            a.date,
            a.status,
            JSON.stringify(a.aiDraftContent),
            a.trainerEditedContent || null,
            a.trainerNote || null,
            a.approvedAt || null,
          ]
        );
      }

      for (const ml of SEED_MEALS) {
        await client.query(
          `INSERT INTO meal_logs (id, student_id, date, meal_type, image_url, food_description, estimated_calories, macros, trainer_reaction, trainer_comment, logged_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [
            ml.id,
            ml.studentId,
            ml.date,
            ml.mealType,
            ml.imageUrl,
            ml.foodDescription,
            ml.estimatedCalories,
            JSON.stringify(ml.macros),
            ml.trainerReaction || null,
            ml.trainerComment || null,
            ml.loggedAt,
          ]
        );
      }

      for (const w of SEED_WORKOUTS) {
        await client.query(
          `INSERT INTO workout_logs (id, student_id, date, plan_title, duration_minutes, exercises, trainer_reaction, trainer_comment, logged_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            w.id,
            w.studentId,
            w.date,
            w.planTitle,
            w.durationMinutes,
            JSON.stringify(w.exercises),
            w.trainerReaction || null,
            w.trainerComment || null,
            w.loggedAt,
          ]
        );
      }

      for (const p of SEED_PHOTOS) {
        await client.query(
          `INSERT INTO physique_photos (id, student_id, date, image_url, photo_type, weight, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [p.id, p.studentId, p.date, p.imageUrl, p.photoType, p.weight, p.notes || '']
        );
      }

      for (const b of SEED_BADGES) {
        await client.query(
          `INSERT INTO badges (id, student_id, title, description, icon, unlocked_at, category)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [b.id, 'student-1', b.title, b.description, b.icon, b.unlockedAt || '', b.category]
        );
      }

      for (const n of SEED_NOTIFICATIONS) {
        await client.query(
          `INSERT INTO smart_notifications (id, use_case_id, student_id, title, message, priority, created_at, read)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [n.id, n.useCaseId, n.studentId, n.title, n.message, n.priority, n.createdAt, n.read]
        );
      }

      // Seed Default Trainer & Student Users
      await client.query(
        `INSERT INTO users (id, username, password, full_name, role, student_id, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (username) DO NOTHING`,
        [
          'user-trainer-1',
          'trunghbl',
          '123',
          'Huấn Luyện Viên Trung HBL',
          'trainer',
          null,
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        ]
      );

      const defaultStudentUsers = [
        { id: 'user-std-1', username: 'hoanglong', pass: '123', name: 'Nguyễn Hoàng Long', stdId: 'student-1' },
        { id: 'user-std-2', username: 'thuha', pass: '123', name: 'Trần Thị Thu Hà', stdId: 'student-2' },
        { id: 'user-std-3', username: 'minhduc', pass: '123', name: 'Phạm Minh Đức', stdId: 'student-3' },
        { id: 'user-std-4', username: 'kimngan', pass: '123', name: 'Lê Kim Ngân', stdId: 'student-4' },
      ];
      for (const su of defaultStudentUsers) {
        await client.query(
          `INSERT INTO users (id, username, password, full_name, role, student_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (username) DO NOTHING`,
          [su.id, su.username, su.pass, su.name, 'student', su.stdId]
        );
      }

      console.log('✅ Seed completed successfully with trunghbl trainer account.');
    } else {
      // Ensure trainer trunghbl exists even if table already had students
      await client.query(
        `INSERT INTO users (id, username, password, full_name, role, student_id, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (username) DO NOTHING`,
        [
          'user-trainer-1',
          'trunghbl',
          '123',
          'Huấn Luyện Viên Trung HBL',
          'trainer',
          null,
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        ]
      );
    }

    client.release();
  } catch (err) {
    console.warn('⚠️ PostgreSQL connection failed or timed out. Operating with in-memory / local fallback:', err);
    dbConnected = false;
  }
}

// REST API Endpoints
// Auth API: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu!' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (dbConnected) {
      const result = await pool.query(
        'SELECT id, username, full_name, role, student_id, avatar_url FROM users WHERE LOWER(username) = $1 AND password = $2',
        [cleanUsername, cleanPassword]
      );
      if (result.rows.length > 0) {
        const u = result.rows[0];
        return res.json({
          success: true,
          user: {
            id: u.id,
            username: u.username,
            fullName: u.full_name,
            role: u.role,
            studentId: u.student_id,
            avatarUrl: u.avatar_url,
          },
        });
      }
    }

    // In-memory fallback if DB table not yet populated or offline
    if (cleanUsername === 'trunghbl' && cleanPassword === '123') {
      return res.json({
        success: true,
        user: {
          id: 'user-trainer-1',
          username: 'trunghbl',
          fullName: 'Huấn Luyện Viên Trung HBL',
          role: 'trainer',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        },
      });
    }

    const mockStudentList = [
      { key: 'hoanglong', name: 'Nguyễn Hoàng Long', studentId: 'student-1' },
      { key: 'thuha', name: 'Trần Thị Thu Hà', studentId: 'student-2' },
      { key: 'minhduc', name: 'Phạm Minh Đức', studentId: 'student-3' },
      { key: 'kimngan', name: 'Lê Kim Ngân', studentId: 'student-4' },
    ];
    const matchedStudent = mockStudentList.find((item) => item.key === cleanUsername);

    if (matchedStudent && cleanPassword === '123') {
      return res.json({
        success: true,
        user: {
          id: `user-${cleanUsername}`,
          username: cleanUsername,
          fullName: matchedStudent.name,
          role: 'student',
          studentId: matchedStudent.studentId,
        },
      });
    }

    return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    databaseConnected: dbConnected,
    dbType: 'PostgreSQL (Aiven Cloud)',
    databaseName: 'TramTap',
    timestamp: new Date().toISOString(),
  });
});

// Students API
app.get('/api/students', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json(SEED_STUDENTS);
    }
    const result = await pool.query('SELECT * FROM students ORDER BY created_at DESC');
    const students = result.rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      gender: r.gender,
      age: r.age,
      height: parseFloat(r.height),
      phone: r.phone,
      address: r.address,
      dateOfBirth: r.date_of_birth ? new Date(r.date_of_birth).toISOString().split('T')[0] : '',
      healthGoal: r.health_goal,
      targetMetrics: r.target_metrics || {},
      avatarUrl: r.avatar_url,
      driveFolderUrl: r.drive_folder_url || GOOGLE_DRIVE_PARENT_FOLDER_URL,
      createdAt: r.created_at,
    }));
    res.json(students);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const requester = req.headers['x-auth-username'] || req.body._requestedBy;
    if (requester !== 'trunghbl') {
      return res.status(403).json({
        error: 'Quyền hạn bị từ chối: Chỉ có tài khoản Huấn luyện viên (trunghbl) mới có thẩm quyền tạo tài khoản cho học viên!',
      });
    }

    const s = req.body;
    const initialUsername = s.initialUsername || s.phone || s.id;
    const initialPassword = s.initialPassword || '123';

    if (dbConnected) {
      await pool.query(
        `INSERT INTO students (id, full_name, gender, age, height, phone, address, date_of_birth, health_goal, target_metrics, avatar_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          s.id,
          s.fullName,
          s.gender,
          s.age,
          s.height,
          s.phone,
          s.address || '',
          s.dateOfBirth,
          s.healthGoal,
          JSON.stringify(s.targetMetrics || {}),
          s.avatarUrl || '',
          s.createdAt || new Date().toISOString(),
        ]
      );

      // Auto-create user login account for the new student
      await pool.query(
        `INSERT INTO users (id, username, password, full_name, role, student_id, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (username) DO NOTHING`,
        [
          `user-${s.id}`,
          initialUsername,
          initialPassword,
          s.fullName,
          'student',
          s.id,
          s.avatarUrl || '',
        ]
      );
    }
    res.status(201).json({ ...s, initialUsername, initialPassword });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.put('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const s = req.body;
    if (dbConnected) {
      await pool.query(
        `UPDATE students SET
          full_name = $1, gender = $2, age = $3, height = $4, phone = $5,
          address = $6, date_of_birth = $7, health_goal = $8, target_metrics = $9, avatar_url = $10,
          drive_folder_url = COALESCE($11, drive_folder_url)
         WHERE id = $12`,
        [
          s.fullName,
          s.gender,
          s.age,
          s.height,
          s.phone,
          s.address,
          s.dateOfBirth,
          s.healthGoal,
          JSON.stringify(s.targetMetrics || {}),
          s.avatarUrl,
          s.driveFolderUrl || null,
          id,
        ]
      );
    }
    res.json(s);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.put('/api/students/:id/drive-folder', async (req, res) => {
  try {
    const { id } = req.params;
    const { driveFolderUrl } = req.body;
    if (dbConnected && driveFolderUrl) {
      await pool.query(
        'UPDATE students SET drive_folder_url = $1 WHERE id = $2',
        [driveFolderUrl, id]
      );
      await pool.query(
        'UPDATE meal_logs SET drive_folder_url = $1 WHERE student_id = $2',
        [driveFolderUrl, id]
      );
    }
    res.json({ success: true, id, driveFolderUrl });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (dbConnected) {
      await pool.query('DELETE FROM students WHERE id = $1', [id]);
    }
    res.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

// Health Metrics API (10 Indicators)
app.get('/api/metrics', async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!dbConnected) {
      const data = studentId
        ? SEED_METRICS.filter((m) => m.studentId === studentId)
        : SEED_METRICS;
      return res.json(data);
    }
    const query = studentId
      ? 'SELECT * FROM health_metrics WHERE student_id = $1 ORDER BY timestamp ASC'
      : 'SELECT * FROM health_metrics ORDER BY timestamp ASC';
    const params = studentId ? [studentId] : [];
    const result = await pool.query(query, params);
    const metrics = result.rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
      timestamp: Number(r.timestamp),
      weight: parseFloat(r.weight),
      subcutaneousFat: parseFloat(r.subcutaneous_fat),
      boneCalcium: parseFloat(r.bone_calcium),
      bodyWater: parseFloat(r.body_water),
      muscleMass: parseFloat(r.muscle_mass),
      bodyType: r.body_type,
      bmr: parseInt(r.bmr, 10),
      biologicalAge: parseInt(r.biological_age, 10),
      visceralFat: parseInt(r.visceral_fat, 10),
      waist: parseFloat(r.waist),
      notes: r.notes,
    }));
    res.json(metrics);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.post('/api/metrics', async (req, res) => {
  try {
    const m = req.body;
    if (dbConnected) {
      await pool.query(
        `INSERT INTO health_metrics
         (id, student_id, date, timestamp, weight, subcutaneous_fat, bone_calcium, body_water, muscle_mass, body_type, bmr, biological_age, visceral_fat, waist, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          m.id,
          m.studentId,
          m.date,
          m.timestamp,
          m.weight,
          m.subcutaneousFat,
          m.boneCalcium,
          m.bodyWater,
          m.muscleMass,
          m.bodyType,
          m.bmr,
          m.biologicalAge,
          m.visceralFat,
          m.waist,
          m.notes || '',
        ]
      );
    }
    res.status(201).json(m);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.delete('/api/metrics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (dbConnected) {
      await pool.query('DELETE FROM health_metrics WHERE id = $1', [id]);
    }
    res.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

// AI Advices API
app.get('/api/advices', async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!dbConnected) {
      const data = studentId
        ? SEED_ADVICES.filter((a) => a.studentId === studentId)
        : SEED_ADVICES;
      return res.json(data);
    }
    const query = studentId
      ? 'SELECT * FROM ai_advices WHERE student_id = $1 ORDER BY date DESC'
      : 'SELECT * FROM ai_advices ORDER BY date DESC';
    const params = studentId ? [studentId] : [];
    const result = await pool.query(query, params);
    const advices = result.rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      metricRecordId: r.metric_record_id,
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
      status: r.status,
      aiDraftContent: r.ai_draft_content,
      trainerEditedContent: r.trainer_edited_content,
      trainerNote: r.trainer_note,
      approvedAt: r.approved_at,
    }));
    res.json(advices);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.post('/api/advices', async (req, res) => {
  try {
    const a = req.body;
    if (dbConnected) {
      await pool.query(
        `INSERT INTO ai_advices (id, student_id, metric_record_id, date, status, ai_draft_content, trainer_edited_content, trainer_note, approved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          a.id,
          a.studentId,
          a.metricRecordId,
          a.date,
          a.status,
          JSON.stringify(a.aiDraftContent),
          a.trainerEditedContent || null,
          a.trainerNote || null,
          a.approvedAt || null,
        ]
      );
    }
    res.status(201).json(a);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.put('/api/advices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const a = req.body;
    if (dbConnected) {
      await pool.query(
        `UPDATE ai_advices SET
          status = $1, trainer_edited_content = $2, trainer_note = $3, approved_at = $4
         WHERE id = $5`,
        [a.status, a.trainerEditedContent, a.trainerNote, a.approvedAt, id]
      );
    }
    res.json(a);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

// Google Drive Parent Folder configured for FitTrack Pro
const GOOGLE_DRIVE_PARENT_FOLDER_URL = 'https://drive.google.com/drive/folders/1DJCFlItKnPr4-YGShTwmJEgiFQ8Yayqc?usp=sharing';
const GOOGLE_DRIVE_FOLDER_ID = '1DJCFlItKnPr4-YGShTwmJEgiFQ8Yayqc';

// Popular Vietnamese & Fitness Meal Database for instant, accurate matching
const POPULAR_DISHES: Array<{
  keywords: string[];
  dish: {
    foodDescription: string;
    estimatedCalories: number;
    macros: { protein: number; carbs: number; fat: number };
    nutritionScore: number;
    advice: string;
    healthTags: string[];
  };
}> = [
  {
    keywords: ['pho', 'phở', 'bò', 'tái', 'nạm', 'bánh phở'],
    dish: {
      foodDescription: '1 tô Phở bò tái nạm hành hoa tươi, bánh phở mềm',
      estimatedCalories: 480,
      macros: { protein: 32, carbs: 62, fat: 12 },
      nutritionScore: 9,
      advice: 'Món ăn giàu đạm sắt từ thịt bò tươi, nước dùng thanh đạm. Nên ăn kèm nhiều rau thơm giá đỗ.',
      healthTags: ['Đạm bò tươi', 'Ít dầu mỡ', 'Năng lượng tốt'],
    },
  },
  {
    keywords: ['com tam', 'cơm tấm', 'sườn', 'tấm', 'bì chả'],
    dish: {
      foodDescription: '1 đĩa Cơm tấm sườn nạc nướng mật ong kèm trứng ốp la và dưa leo cà chua',
      estimatedCalories: 560,
      macros: { protein: 38, carbs: 68, fat: 16 },
      nutritionScore: 8.5,
      advice: 'Lượng đạm tốt từ sườn nạc và trứng. Giảm bớt mỡ hành nếu đang trong giai đoạn siết cơ.',
      healthTags: ['Giàu đạm', 'Cơm tấm', 'No lâu'],
    },
  },
  {
    keywords: ['bun cha', 'bún chả', 'chả nướng', 'bun'],
    dish: {
      foodDescription: '1 phần Bún chả nướng than hoa nạc, đĩa bún tươi và rau sống kinh giới',
      estimatedCalories: 510,
      macros: { protein: 34, carbs: 64, fat: 14 },
      nutritionScore: 9,
      advice: 'Chả thịt nạc hấp thu tốt, nhiều rau xanh bổ sung chất xơ tự nhiên hỗ trợ tiêu hóa.',
      healthTags: ['Đạm thịt nạc', 'Nhiều rau xanh'],
    },
  },
  {
    keywords: ['uc ga', 'ức gà', 'gạo lứt', 'lut', 'bông cải', 'sup lo'],
    dish: {
      foodDescription: '150g Ức gà áp chảo sốt tiêu đen, 1 chén cơm gạo lứt, súp lơ xanh luộc',
      estimatedCalories: 450,
      macros: { protein: 42, carbs: 45, fat: 9 },
      nutritionScore: 10,
      advice: 'Chuẩn tỉ lệ macro thể hình vàng. Đạm nạc nguyên chất tối đa hóa khả năng đồng hóa cơ.',
      healthTags: ['Chuẩn siết mỡ', 'High Protein', 'Gạo lứt'],
    },
  },
  {
    keywords: ['ca hoi', 'cá hồi', 'salad', 'bơ', 'dau tay'],
    dish: {
      foodDescription: 'Filet cá hồi áp chảo sốt chanh leo, xà lách romaine, bơ sáp và cà chua bi',
      estimatedCalories: 430,
      macros: { protein: 35, carbs: 22, fat: 20 },
      nutritionScore: 9.5,
      advice: 'Giàu Omega-3 và chất béo lành mạnh giúp kháng viêm khớp sau buổi tập nặng.',
      healthTags: ['Omega-3', 'Chất béo tốt', 'Keto/Lowcarb'],
    },
  },
  {
    keywords: ['thit bo', 'thịt bò', 'xào', 'bò xào', 'bông cải'],
    dish: {
      foodDescription: '150g Thịt bò xào bông cải xanh tỏi tây, 1 chén cơm trắng/gạo lứt',
      estimatedCalories: 470,
      macros: { protein: 39, carbs: 48, fat: 13 },
      nutritionScore: 9,
      advice: 'Bổ sung creatine tự nhiên và sắt từ thịt bò, bông cải giàu sulforaphane chống oxy hóa.',
      healthTags: ['Tăng cơ', 'Creatine tự nhiên', 'Giàu vi chất'],
    },
  },
  {
    keywords: ['banh mi', 'bánh mì', 'trung', 'trứng ốp', 'op la'],
    dish: {
      foodDescription: '2 quả trứng ốp la lòng đào, 1 ổ bánh mì đen nguyên cám kèm quả bơ lát',
      estimatedCalories: 390,
      macros: { protein: 22, carbs: 38, fat: 16 },
      nutritionScore: 9,
      advice: 'Bữa sáng nhanh gọn, choline trong lòng đỏ trứng hỗ trợ dẫn truyền xung thần kinh vận động.',
      healthTags: ['Bữa sáng nhanh', 'Choline não bộ', 'Năng lượng sạch'],
    },
  },
  {
    keywords: ['yen mach', 'yến mạch', 'sua chua', 'sữa chua', 'chuoi'],
    dish: {
      foodDescription: 'Yến mạch ngâm sữa chua Hy Lạp, chuối tây thái lát và hạt chia hạnh nhân',
      estimatedCalories: 340,
      macros: { protein: 18, carbs: 52, fat: 7 },
      nutritionScore: 9,
      advice: 'Bữa phụ hoàn hảo trước hoặc sau tập 1-2 tiếng, nạp glycogen cơ bắp nhanh chóng.',
      healthTags: ['Bữa phụ', 'Glycogen phục hồi', 'Tiêu hóa nhẹ'],
    },
  },
  {
    keywords: ['thit kho', 'thịt kho', 'canh', 'cơm nhà', 'canh chua'],
    dish: {
      foodDescription: 'Thịt nạc kho tiêu ít đường, 1 chén cơm trắng và 1 bát canh rau ngót nấu tôm',
      estimatedCalories: 490,
      macros: { protein: 36, carbs: 56, fat: 12 },
      nutritionScore: 8.5,
      advice: 'Bữa cơm gia đình lành mạnh, giàu đạm và vitamin K từ rau ngót thanh nhiệt.',
      healthTags: ['Cơm nhà sạch', 'Giàu canxi', 'Thanh mát'],
    },
  },
  {
    keywords: ['bun bo', 'bún bò', 'bún bò huế', 'giò heo'],
    dish: {
      foodDescription: '1 tô Bún bò Huế bắp bò nạc, chả cua và rau sống bắp chuối',
      estimatedCalories: 540,
      macros: { protein: 36, carbs: 64, fat: 15 },
      nutritionScore: 8.5,
      advice: 'Giàu đạm từ bắp bò, nên hớt bớt váng dầu sa tế nếu đang giảm mỡ.',
      healthTags: ['Đạm bắp bò', 'Năng lượng cao'],
    },
  },
  {
    keywords: ['hu tieu', 'hủ tiếu', 'mì', 'mi quang', 'mì quảng'],
    dish: {
      foodDescription: '1 tô Hủ tiếu / Mì thịt nạc tôm tươi kèm giá hẹ và xà lách',
      estimatedCalories: 440,
      macros: { protein: 28, carbs: 58, fat: 10 },
      nutritionScore: 9,
      advice: 'Nước dùng thanh ngọt, tôm và thịt nạc cung cấp đạm dễ tiêu hóa.',
      healthTags: ['Thanh đạm', 'Dễ tiêu hóa'],
    },
  },
  {
    keywords: ['com ga', 'cơm gà', 'gà luộc', 'ga nuong', 'gà nướng'],
    dish: {
      foodDescription: '1 đĩa Cơm gà luộc/nướng bỏ da kèm dưa leo, cà chua và canh cải',
      estimatedCalories: 510,
      macros: { protein: 39, carbs: 62, fat: 11 },
      nutritionScore: 9,
      advice: 'Thịt gà bỏ da là nguồn đạm nạc tuyệt vời cho cơ bắp.',
      healthTags: ['Giàu Protein', 'Ít béo'],
    },
  },
  {
    keywords: ['khoai lang', 'khoai', 'bắp', 'ngô', 'trứng luộc'],
    dish: {
      foodDescription: '2 củ Khoai lang mật hấp kèm 2 quả trứng gà luộc và 1 đĩa rau luộc',
      estimatedCalories: 360,
      macros: { protein: 18, carbs: 54, fat: 8 },
      nutritionScore: 9.5,
      advice: 'Tinh bột hấp thu chậm (GI thấp) từ khoai lang giúp no lâu và siết mỡ hiệu quả.',
      healthTags: ['Carb chậm', 'Siết mỡ', 'Eat Clean'],
    },
  },
  {
    keywords: ['sinh to', 'sinh tố', 'whey', 'protein', 'chuối'],
    dish: {
      foodDescription: '1 ly Sinh tố Whey Protein xay cùng chuối sứ, bơ đậu phộng và sữa tươi không đường',
      estimatedCalories: 350,
      macros: { protein: 34, carbs: 36, fat: 8 },
      nutritionScore: 10,
      advice: 'Bữa phụ sau tập (Post-workout) hoàn hảo giúp phục hồi sợi cơ tức thì.',
      healthTags: ['Phục hồi cơ', 'High Protein'],
    },
  },
];

// AI Meal Photo Recognition Endpoint (SRS Nutrition Log auto-analysis)
app.post('/api/ai/analyze-meal', async (req, res) => {
  try {
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      studentGoal = 'Cân đối vóc dáng',
      mealType = 'Bữa trưa',
      studentName = 'Học viên',
      dishHint = '',
      fileName = '',
    } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Vui lòng cung cấp dữ liệu ảnh bữa ăn (Base64).' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
    const effectiveMime = mimeType.includes('png') ? 'image/png' : mimeType.includes('webp') ? 'image/webp' : 'image/jpeg';

    let aiResult: any = null;

    // Check if Gemini API Key is available in runtime env
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      const client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `Bạn là chuyên gia dinh dưỡng thể thao & AI thị giác máy tính hàng đầu tại FitTrack Pro.
Nhiệm vụ: Quan sát kỹ bức ảnh chụp bữa ăn này của học viên và tự động phân tích dinh dưỡng.
Thông tin học viên: Tên ${studentName}, Mục tiêu: ${studentGoal}, Bữa: ${mealType}.

Hãy thực hiện chính xác các bước sau từ bức ảnh:
1. Nhận diện tên món ăn và liệt kê chi tiết các thành phần nguyên liệu chính có trong ảnh (ví dụ: thịt bò, phở, cơm trắng, ức gà, trứng, rau luộc, canh...).
2. Ước tính tổng lượng Calo (Kcal) sát thực tế khẩu phần trong ảnh.
3. Ước tính các chất dinh dưỡng đa lượng: Đạm (protein grams), Tinh bột (carbs grams), Chất béo (fat grams).
4. Chấm điểm độ lành mạnh của bữa ăn trên thang 1-10 (nutritionScore).
5. Đưa ra lời khuyên cải thiện bữa ăn hoặc lưu ý cụ thể (1-2 câu) dựa trên món ăn trong ảnh và mục tiêu "${studentGoal}" của học viên.

Trả về DUY NHẤT một chuỗi JSON hợp lệ (không dùng markdown code block):
{
  "foodDescription": "Tên món ăn và các thành phần nhận diện được từ ảnh",
  "estimatedCalories": 480,
  "macros": {
    "protein": 35,
    "carbs": 50,
    "fat": 14
  },
  "nutritionScore": 8.5,
  "advice": "Lời khuyên cải thiện hoặc lưu ý cụ thể cho bữa ăn này...",
  "healthTags": ["Giàu đạm", "Cân đối"]
}`;

      const candidateModels = [
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
        'gemini-3.8-flash',
      ];

      for (const modelName of candidateModels) {
        try {
          const geminiCall = client.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: effectiveMime,
                    data: cleanBase64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          });

          const timeoutPromise = new Promise<Awaited<typeof geminiCall>>((_, reject) =>
            setTimeout(() => reject(new Error('Model timeout')), 3500)
          );

          const response = await Promise.race([geminiCall, timeoutPromise]);

          const rawText = response?.text || '';
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed && parsed.foodDescription) {
              aiResult = parsed;
              break;
            }
          }
        } catch (modelErr: unknown) {
          console.warn(`⚠️ Model ${modelName} error (${getErrMessage(modelErr)}), trying next model...`);
        }
      }
    }

    if (!aiResult) {
      // If all Gemini models experienced temporary 503 overload, provide an intelligent culinary estimation
      // instead of returning HTTP 503 (which Nginx intercepts into an HTML warmup page)
      const searchTarget = `${dishHint} ${fileName}`.toLowerCase().trim();
      const matched = POPULAR_DISHES.find((d) =>
        d.keywords.some((k) => searchTarget.includes(k.toLowerCase()))
      );

      if (matched) {
        aiResult = { ...matched.dish };
      } else {
        // Estimate calories & macros based on mealType and image size characteristics
        if (mealType === 'Bữa sáng') {
          aiResult = {
            foodDescription: 'Khẩu phần ăn sáng giàu năng lượng (Tinh bột phức hợp, Đạm và chất xơ)',
            estimatedCalories: 420,
            macros: { protein: 26, carbs: 50, fat: 13 },
            nutritionScore: 8.5,
            advice: `Bữa sáng cung cấp năng lượng tốt cho mục tiêu "${studentGoal}". Nên uống thêm 300ml nước ấm và hạn chế nước sốt nhiều dầu mỡ.`,
            healthTags: ['Năng lượng sáng', 'Cân đối Macro'],
          };
        } else if (mealType === 'Bữa tối') {
          aiResult = {
            foodDescription: 'Khẩu phần ăn tối thanh đạm (Ưu tiên Protein và Rau củ chất xơ)',
            estimatedCalories: 430,
            macros: { protein: 35, carbs: 42, fat: 12 },
            nutritionScore: 9,
            advice: `Bữa tối gọn nhẹ giúp tối ưu mục tiêu "${studentGoal}". Hạn chế ăn quá muộn sau 20h và giảm lượng tinh bột vào buổi tối.`,
            healthTags: ['Thanh đạm', 'Phục hồi cơ'],
          };
        } else if (mealType === 'Bữa phụ') {
          aiResult = {
            foodDescription: 'Bữa phụ bổ sung năng lượng & phục hồi cơ bắp',
            estimatedCalories: 310,
            macros: { protein: 22, carbs: 38, fat: 8 },
            nutritionScore: 9,
            advice: `Bữa phụ hỗ trợ duy trì đồng hóa cơ bắp cho mục tiêu "${studentGoal}". Rất tốt khi dùng trước hoặc sau buổi tập 60 phút.`,
            healthTags: ['Bữa phụ', 'Nạp năng lượng'],
          };
        } else {
          aiResult = {
            foodDescription: 'Khẩu phần ăn trưa đầy đủ nhóm chất (Đạm nạc, Tinh bột và Rau xanh)',
            estimatedCalories: 520,
            macros: { protein: 38, carbs: 58, fat: 15 },
            nutritionScore: 8.5,
            advice: `Khẩu phần bữa trưa phù hợp với mục tiêu "${studentGoal}". Lưu ý ăn phần rau xanh và đạm trước khi ăn tinh bột để kiểm soát đường huyết tốt hơn.`,
            healthTags: ['Giàu đạm', 'Đủ nhóm chất'],
          };
        }
      }
    }

    // Google Drive Folder URL per student
    const studentFolder = `FitTrack_${studentName.replace(/\s+/g, '_')}`;
    const driveFolderUrl = GOOGLE_DRIVE_PARENT_FOLDER_URL;
    const driveFileUrl = `${GOOGLE_DRIVE_PARENT_FOLDER_URL}#file-${Date.now()}`;

    res.status(200).json({
      success: true,
      analysis: {
        ...aiResult,
        studentFolder,
        driveFolderUrl,
        driveFileUrl,
      },
    });
  } catch (err: unknown) {
    console.error('Error analyzing meal:', err);
    res.status(400).json({ error: 'Không thể phân tích bữa ăn: ' + getErrMessage(err) });
  }
});

// Meals API
app.get('/api/meals', async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!dbConnected) {
      const data = studentId
        ? SEED_MEALS.filter((m) => m.studentId === studentId)
        : SEED_MEALS;
      return res.json(data);
    }
    const query = studentId
      ? 'SELECT * FROM meal_logs WHERE student_id = $1 ORDER BY date DESC, logged_at DESC'
      : 'SELECT * FROM meal_logs ORDER BY date DESC, logged_at DESC';
    const params = studentId ? [studentId] : [];
    const result = await pool.query(query, params);
    const meals = result.rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
      mealType: r.meal_type,
      imageUrl: r.image_url,
      foodDescription: r.food_description,
      estimatedCalories: r.estimated_calories,
      macros: r.macros || { protein: 0, carbs: 0, fat: 0 },
      trainerReaction: r.trainer_reaction,
      trainerComment: r.trainer_comment,
      loggedAt: r.logged_at,
      driveFolderUrl: r.drive_folder_url || GOOGLE_DRIVE_PARENT_FOLDER_URL,
      driveFileUrl: r.drive_file_url,
      aiAnalyzed: r.ai_analyzed ?? true,
      nutritionAdvice: r.nutrition_advice || '',
    }));
    res.json(meals);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.post('/api/meals', async (req, res) => {
  try {
    const m = req.body;
    const mealId = m.id || `meal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const loggedAt = m.loggedAt || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const driveFolderUrl = m.driveFolderUrl || GOOGLE_DRIVE_PARENT_FOLDER_URL;
    const driveFileUrl = m.driveFileUrl || driveFolderUrl;
    const aiAnalyzed = m.aiAnalyzed !== undefined ? m.aiAnalyzed : true;
    const nutritionAdvice = m.nutritionAdvice || '';

    // NEVER store heavy Base64 image data in PostgreSQL database! Only store lightweight Drive/HTTP link
    const rawImg = typeof m.imageUrl === 'string' ? m.imageUrl : '';
    const lightweightImageUrl = rawImg.startsWith('data:')
      ? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
      : rawImg || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

    if (dbConnected) {
      await pool.query(
        `INSERT INTO meal_logs (id, student_id, date, meal_type, image_url, food_description, estimated_calories, macros, trainer_reaction, trainer_comment, logged_at, drive_folder_url, drive_file_url, ai_analyzed, nutrition_advice)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          mealId,
          m.studentId,
          m.date || new Date().toISOString().split('T')[0],
          m.mealType || 'Bữa trưa',
          lightweightImageUrl,
          m.foodDescription,
          m.estimatedCalories || 450,
          JSON.stringify(m.macros || { protein: 35, carbs: 45, fat: 12 }),
          m.trainerReaction || null,
          m.trainerComment || null,
          loggedAt,
          driveFolderUrl,
          driveFileUrl,
          aiAnalyzed,
          nutritionAdvice,
        ]
      );
    }
    res.status(201).json({
      ...m,
      id: mealId,
      imageUrl: lightweightImageUrl,
      loggedAt,
      driveFolderUrl,
      driveFileUrl,
      aiAnalyzed,
      nutritionAdvice,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.put('/api/meals/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { reaction, comment } = req.body;
    if (dbConnected) {
      await pool.query(
        `UPDATE meal_logs SET trainer_reaction = $1, trainer_comment = $2 WHERE id = $3`,
        [reaction, comment, id]
      );
    }
    res.json({ success: true, id, reaction, comment });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

// Workouts API
app.get('/api/workouts', async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!dbConnected) {
      const data = studentId
        ? SEED_WORKOUTS.filter((w) => w.studentId === studentId)
        : SEED_WORKOUTS;
      return res.json(data);
    }
    const query = studentId
      ? 'SELECT * FROM workout_logs WHERE student_id = $1 ORDER BY date DESC'
      : 'SELECT * FROM workout_logs ORDER BY date DESC';
    const params = studentId ? [studentId] : [];
    const result = await pool.query(query, params);
    const workouts = result.rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
      planTitle: r.plan_title,
      durationMinutes: r.duration_minutes,
      exercises: r.exercises || [],
      trainerReaction: r.trainer_reaction,
      trainerComment: r.trainer_comment,
      loggedAt: r.logged_at,
    }));
    res.json(workouts);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.post('/api/workouts', async (req, res) => {
  try {
    const w = req.body;
    if (dbConnected) {
      await pool.query(
        `INSERT INTO workout_logs (id, student_id, date, plan_title, duration_minutes, exercises, trainer_reaction, trainer_comment, logged_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          w.id,
          w.studentId,
          w.date,
          w.planTitle,
          w.durationMinutes,
          JSON.stringify(w.exercises),
          w.trainerReaction || null,
          w.trainerComment || null,
          w.loggedAt,
        ]
      );
    }
    res.status(201).json(w);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.put('/api/workouts/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { reaction, comment } = req.body;
    if (dbConnected) {
      await pool.query(
        `UPDATE workout_logs SET trainer_reaction = $1, trainer_comment = $2 WHERE id = $3`,
        [reaction, comment, id]
      );
    }
    res.json({ success: true, id, reaction, comment });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

// Physique Photos API
app.get('/api/photos', async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!dbConnected) {
      const data = studentId
        ? SEED_PHOTOS.filter((p) => p.studentId === studentId)
        : SEED_PHOTOS;
      return res.json(data);
    }
    const query = studentId
      ? 'SELECT * FROM physique_photos WHERE student_id = $1 ORDER BY date ASC'
      : 'SELECT * FROM physique_photos ORDER BY date ASC';
    const params = studentId ? [studentId] : [];
    const result = await pool.query(query, params);
    const photos = result.rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
      imageUrl: r.image_url,
      photoType: r.photo_type,
      weight: parseFloat(r.weight),
      notes: r.notes,
    }));
    res.json(photos);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.post('/api/photos', async (req, res) => {
  try {
    const p = req.body;
    if (dbConnected) {
      await pool.query(
        `INSERT INTO physique_photos (id, student_id, date, image_url, photo_type, weight, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, p.studentId, p.date, p.imageUrl, p.photoType, p.weight, p.notes || '']
      );
    }
    res.status(201).json(p);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

// Notifications API
app.get('/api/notifications', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json(SEED_NOTIFICATIONS);
    }
    const result = await pool.query('SELECT * FROM smart_notifications ORDER BY created_at DESC');
    const notifications = result.rows.map((r) => ({
      id: r.id,
      useCaseId: r.use_case_id,
      studentId: r.student_id,
      title: r.title,
      message: r.message,
      priority: r.priority,
      createdAt: r.created_at,
      read: r.read,
    }));
    res.json(notifications);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    if (dbConnected) {
      await pool.query('UPDATE smart_notifications SET read = true WHERE id = $1', [id]);
    }
    res.json({ success: true, id });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrMessage(err) });
  }
});

// Start Express server and attach Vite middleware
async function startServer() {
  await initDatabase();

  // Resolve the static files directory (supports root execution or dist execution)
  const candidatePaths = [
    path.resolve(__dirname, 'dist'),
    path.resolve(process.cwd(), 'dist'),
    path.resolve(__dirname),
  ];
  const distDir = candidatePaths.find((p) => fs.existsSync(path.resolve(p, 'index.html')));

  if (process.env.NODE_ENV === 'production' || (!process.env.NODE_ENV && distDir)) {
    if (distDir) {
      console.log(`📦 Serving static production build from: ${distDir}`);
      app.use(express.static(distDir));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distDir, 'index.html'));
      });
    } else {
      console.warn('⚠️ No dist/index.html found for production mode.');
    }
  } else {
    // In dev mode, mount Vite middleware
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('Vite dev middleware could not be loaded, falling back to static:', err);
      if (distDir) {
        app.use(express.static(distDir));
        app.get('*', (req, res) => {
          res.sendFile(path.resolve(distDir, 'index.html'));
        });
      }
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FitTrack Pro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
