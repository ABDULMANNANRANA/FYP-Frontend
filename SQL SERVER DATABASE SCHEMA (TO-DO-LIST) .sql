-- ==========================================================
-- TODO SMART ALERTS - SQL Server
-- ==========================================================

CREATE DATABASE TodoSmartAlerts;
GO

USE TodoSmartAlerts;
GO

Select * from Users

-- ==========================================================
-- USERS
-- ==========================================================

CREATE TABLE Users
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    FirstName VARCHAR(100) NOT NULL,
    LastName VARCHAR(100) NOT NULL,

    Email VARCHAR(200) NOT NULL UNIQUE,

    PhoneNumber VARCHAR(20),

    Password VARCHAR(255) NOT NULL,
    LastLatitude FLOAT NULL,
    LastLongitude FLOAT NULL,
    LastLocationUpdatedAt DATETIME NULL,

    CreatedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    IsActive BIT NOT NULL
        DEFAULT 1
);


GO

-- ==========================================================
-- GROUPS
-- ==========================================================

CREATE TABLE GroupsUser
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    Name VARCHAR(150) NOT NULL,

    CreatedBy INT NOT NULL,

    CreatedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_GroupsUser_CreatedBy
        FOREIGN KEY (CreatedBy)
        REFERENCES Users(Id)
);
GO

-- ==========================================================
-- GROUP MEMBERS
-- ==========================================================

CREATE TABLE GroupMembers
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    GroupId INT NOT NULL,

    UserId INT NULL,

    Name VARCHAR(150),

    Phone VARCHAR(20),

    Role VARCHAR(10) NOT NULL
        DEFAULT 'Member'
        CHECK (Role IN ('Admin','Member')),

    AddedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_GroupMembers_Group
        FOREIGN KEY (GroupId)
        REFERENCES GroupsUser(Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_GroupMembers_User
        FOREIGN KEY (UserId)
        REFERENCES Users(Id)
);
GO

-- ==========================================================
-- TASKS
-- ==========================================================

CREATE TABLE Tasks
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    Title VARCHAR(300) NOT NULL,

    Description VARCHAR(MAX),

    IsTimeBased BIT NOT NULL
        DEFAULT 1,

    DueDate DATE,

    DueTime TIME,

    GroupId INT NULL,

    CreatedBy INT NOT NULL,

    AssignedTo INT NULL,

    Status VARCHAR(20) NOT NULL
        DEFAULT 'Pending'
        CHECK (Status IN ('Pending','Done','Snoozed','Cancelled')),
    
    Latitude DECIMAL(10,7) NULL,
    Longitude DECIMAL(10,7) NULL,
    GeofenceRadiusMeters INT NOT NULL DEFAULT 200,
    GeofenceEnabled BIT NOT NULL DEFAULT 1,

    CreatedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    UpdatedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_Tasks_Group
        FOREIGN KEY (GroupId)
        REFERENCES GroupsUser(Id)
        ON DELETE SET NULL,

    CONSTRAINT FK_Tasks_CreatedBy
        FOREIGN KEY (CreatedBy)
        REFERENCES Users(Id),

    CONSTRAINT FK_Tasks_AssignedTo
        FOREIGN KEY (AssignedTo)
        REFERENCES Users(Id)
);
GO

-- ==========================================================
-- UPDATE TIMESTAMP
-- ==========================================================

CREATE TRIGGER trg_Tasks_UpdatedAt
ON Tasks
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE T
    SET UpdatedAt = GETDATE()
    FROM Tasks T
    INNER JOIN inserted I
        ON T.Id = I.Id;
END;
GO

-- ==========================================================
-- NOTIFICATIONS
-- ==========================================================

CREATE TABLE Notifications
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    TaskId INT NOT NULL,

    UserId INT NOT NULL,

    Message VARCHAR(MAX),

    IsRead BIT NOT NULL
        DEFAULT 0,

    SentAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_Notifications_Task
        FOREIGN KEY (TaskId)
        REFERENCES Tasks(Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Notifications_User
        FOREIGN KEY (UserId)
        REFERENCES Users(Id)
);
GO

-- ==========================================================
-- FORWARDED TASKS
-- ==========================================================

CREATE TABLE ForwardedTasks
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    OriginalTaskId INT NOT NULL,

    ForwardedBy INT NOT NULL,

    ForwardedTo INT NOT NULL,

    ForwardedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_Forwarded_Task
        FOREIGN KEY (OriginalTaskId)
        REFERENCES Tasks(Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Forwarded_By
        FOREIGN KEY (ForwardedBy)
        REFERENCES Users(Id),

    CONSTRAINT FK_Forwarded_To
        FOREIGN KEY (ForwardedTo)
        REFERENCES Users(Id)
);
GO

-- ==========================================================
-- SNOOZE LOG
-- ==========================================================

CREATE TABLE SnoozeLogs
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    TaskId INT NOT NULL,

    UserId INT NOT NULL,

    SnoozedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    WakeAt DATETIME NOT NULL,

    CONSTRAINT FK_Snooze_Task
        FOREIGN KEY (TaskId)
        REFERENCES Tasks(Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Snooze_User
        FOREIGN KEY (UserId)
        REFERENCES Users(Id)
);
GO


USE TodoSmartAlerts;


ALTER TABLE Notifications
ADD SenderId INT NULL;


ALTER TABLE Notifications
ADD Type VARCHAR(30) NULL;


ALTER TABLE Notifications
ADD CONSTRAINT FK_Notifications_Sender
FOREIGN KEY (SenderId)
REFERENCES Users(Id);







-- ==========================================================
-- SAMPLE DATA
-- ==========================================================

INSERT INTO Users
(
    FirstName,
    LastName,
    Email,
    PhoneNumber,
    Password
)
VALUES
(
    'abc',
    'xyz',
    'abc@gmail.com',
    '0333322344',
    '123'
);
GO

SELECT * FROM Users;
SELECT * FROM GroupsUser;
SELECT * FROM GroupMembers;
SELECT * FROM Tasks;
GO








-- ==========================================================
--                       For Prompt:
-- ==========================================================

CREATE DATABASE TodoSmartAlerts;
USE TodoSmartAlerts;

CREATE TABLE Users
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    FirstName VARCHAR(100) NOT NULL,
    LastName VARCHAR(100) NOT NULL,

    Email VARCHAR(200) NOT NULL UNIQUE,

    PhoneNumber VARCHAR(20),

    Password VARCHAR(255) NOT NULL,

    CreatedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    IsActive BIT NOT NULL
        DEFAULT 1
);

CREATE TABLE GroupsUser
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    Name VARCHAR(150) NOT NULL,

    CreatedBy INT NOT NULL,

    CreatedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_GroupsUser_CreatedBy
        FOREIGN KEY (CreatedBy)
        REFERENCES Users(Id)
);

CREATE TABLE GroupMembers
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    GroupId INT NOT NULL,

    UserId INT NULL,

    Name VARCHAR(150),

    Phone VARCHAR(20),

    Role VARCHAR(10) NOT NULL
        DEFAULT 'Member'
        CHECK (Role IN ('Admin','Member')),

    AddedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_GroupMembers_Group
        FOREIGN KEY (GroupId)
        REFERENCES GroupsUser(Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_GroupMembers_User
        FOREIGN KEY (UserId)
        REFERENCES Users(Id)
);

CREATE TABLE Tasks
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    Title VARCHAR(300) NOT NULL,

    Description VARCHAR(MAX),

    IsTimeBased BIT NOT NULL
        DEFAULT 1,

    DueDate DATE,

    DueTime TIME,

    GroupId INT NULL,

    CreatedBy INT NOT NULL,

    AssignedTo INT NULL,

    Status VARCHAR(20) NOT NULL
        DEFAULT 'Pending'
        CHECK (Status IN ('Pending','Done','Snoozed','Cancelled')),

    CreatedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    UpdatedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_Tasks_Group
        FOREIGN KEY (GroupId)
        REFERENCES GroupsUser(Id)
        ON DELETE SET NULL,

    CONSTRAINT FK_Tasks_CreatedBy
        FOREIGN KEY (CreatedBy)
        REFERENCES Users(Id),

    CONSTRAINT FK_Tasks_AssignedTo
        FOREIGN KEY (AssignedTo)
        REFERENCES Users(Id)
);

CREATE TRIGGER trg_Tasks_UpdatedAt
ON Tasks
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE T
    SET UpdatedAt = GETDATE()
    FROM Tasks T
    INNER JOIN inserted I
        ON T.Id = I.Id;
END;

CREATE TABLE Notifications
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    TaskId INT NOT NULL,

    UserId INT NOT NULL,

    Message VARCHAR(MAX),

    IsRead BIT NOT NULL
        DEFAULT 0,

    SentAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    Type VARCHAR(30) NULL,

    SenderId INT NULL

    CONSTRAINT FK_Notifications_Sender
    FOREIGN KEY (SenderId)
    REFERENCES Users(Id),


    CONSTRAINT FK_Notifications_Task
        FOREIGN KEY (TaskId)
        REFERENCES Tasks(Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Notifications_User
        FOREIGN KEY (UserId)
        REFERENCES Users(Id)
);

CREATE TABLE ForwardedTasks
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    OriginalTaskId INT NOT NULL,

    ForwardedBy INT NOT NULL,

    ForwardedTo INT NOT NULL,

    ForwardedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_Forwarded_Task
        FOREIGN KEY (OriginalTaskId)
        REFERENCES Tasks(Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Forwarded_By
        FOREIGN KEY (ForwardedBy)
        REFERENCES Users(Id),

    CONSTRAINT FK_Forwarded_To
        FOREIGN KEY (ForwardedTo)
        REFERENCES Users(Id)
);

CREATE TABLE SnoozeLogs
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    TaskId INT NOT NULL,

    UserId INT NOT NULL,

    SnoozedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    WakeAt DATETIME NOT NULL,

    CONSTRAINT FK_Snooze_Task
        FOREIGN KEY (TaskId)
        REFERENCES Tasks(Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Snooze_User
        FOREIGN KEY (UserId)
        REFERENCES Users(Id)
);

CREATE TABLE UserSettings
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    UserId INT NOT NULL UNIQUE,

    NotificationEnabled BIT NOT NULL
        DEFAULT 1,

    DarkModeEnabled BIT NOT NULL
        DEFAULT 0,

    SnoozeMinutes INT NOT NULL
        DEFAULT 5,

    UpdatedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_UserSettings_User
        FOREIGN KEY(UserId)
        REFERENCES Users(Id)
        ON DELETE CASCADE
);


CREATE TABLE TaskResponses
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    TaskId INT NOT NULL,

    UserId INT NOT NULL,

    Response VARCHAR(20) NOT NULL
        CHECK (Response IN ('Picked','Ignored')),

    RespondedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_TaskResponses_Task
        FOREIGN KEY (TaskId)
        REFERENCES Tasks(Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_TaskResponses_User
        FOREIGN KEY (UserId)
        REFERENCES Users(Id),

    CONSTRAINT UQ_TaskResponses
        UNIQUE(TaskId, UserId)
);


CREATE TABLE TaskMentions
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    TaskId INT NOT NULL,

    MentionedUserId INT NOT NULL,

    MentionedBy INT NOT NULL,

    MentionedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_TaskMentions_Task
        FOREIGN KEY (TaskId)
        REFERENCES Tasks(Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_TaskMentions_MentionedUser
        FOREIGN KEY (MentionedUserId)
        REFERENCES Users(Id),

    CONSTRAINT FK_TaskMentions_MentionedBy
        FOREIGN KEY (MentionedBy)
        REFERENCES Users(Id),

    CONSTRAINT UQ_TaskMention
        UNIQUE(TaskId, MentionedUserId)
);

CREATE TABLE UserLocations
(
    Id INT IDENTITY(1,1) PRIMARY KEY,

    UserId INT NOT NULL UNIQUE,

    Latitude DECIMAL(10,7) NOT NULL,

    Longitude DECIMAL(10,7) NOT NULL,

    Accuracy DECIMAL(10,2) NULL,

    UpdatedAt DATETIME NOT NULL
        DEFAULT GETDATE(),

    CONSTRAINT FK_UserLocations_User
        FOREIGN KEY(UserId)
        REFERENCES Users(Id)
        ON DELETE CASCADE
);

















USE TodoSmartAlerts;
GO

-- 1. USERS (5 Records)
INSERT INTO Users (FirstName, LastName, Email, PhoneNumber, Password) VALUES
('John', 'Doe', 'john.doe1@example.com', '03001234567', 'HashedPwd123!'),
('Jane', 'Smith', 'jane.smith1@example.com', '03119876543', 'HashedPwd456!'),
('Ali', 'Khan', 'ali.khan1@example.com', '03225551234', 'HashedPwd789!'),
('Sara', 'Ahmed', 'sara.ahmed1@example.com', '03334445566', 'HashedPwd321!'),
('Usman', 'Raza', 'usman.raza1@example.com', '03447778899', 'HashedPwd654!');
GO

-- 2. USER SETTINGS (5 Records)
INSERT INTO UserSettings (UserId, NotificationEnabled, DarkModeEnabled, SnoozeMinutes) VALUES
(7, 1, 1, 10),
(6, 1, 0, 5),
(3, 0, 0, 15),
(4, 1, 1, 5),
(5, 1, 0, 30);
GO

-- 3. GROUPS (5 Records)
INSERT INTO GroupsUser (Name, CreatedBy) VALUES
('Development Team', 7),
('Marketing Squad', 6),
('FYP Project Group', 3),
('Family Tasks', 7),
('Design Reviewers', 4);
GO

-- 4. GROUP MEMBERS (5 Records)
INSERT INTO GroupMembers (GroupId, UserId, Name, Phone, Role) VALUES
(5, 7, 'John Doe', '03001234567', 'Admin'),
(9, 6, 'Jane Smith', '03119876543', 'Member'),
(6, 6, 'Jane Smith', '03119876543', 'Admin'),
(7, 3, 'Ali Khan', '03225551234', 'Admin'),
(8, 4, 'Sara Ahmed', '03334445566', 'Member');
GO

-- 5. TASKS (5 Records)
INSERT INTO Tasks (Title, Description, IsTimeBased, DueDate, DueTime, GroupId, CreatedBy, AssignedTo, Status) VALUES
('Setup Database Schema', 'Deploy SQL Server scripts for task management.', 1, '2026-09-01', '10:00:00', 5, 1, 1, 'Done'),
('Design Figma Mockups', 'Complete UI flow for task assignment screens.', 1, '2026-09-05', '14:30:00', 5, 4, 3, 'Pending'),
('Submit Sprint Report', 'Compile team progress for the current sprint.', 0, '2026-09-10', NULL, 8, 1, 3, 'Pending'),
('Review Code Pull Request', 'Inspect C# ASP.NET Core endpoints.', 1, '2026-08-30', '16:00:00', 6, 5, 1, 'Snoozed'),
('Buy Household Supplies', 'Pick up groceries on the way home.', 0, '2026-08-28', NULL, 8, 1, 1, 'Cancelled');
GO


-- 6. NOTIFICATIONS (5 Records)
INSERT INTO Notifications (TaskId, UserId, Message, IsRead) VALUES
(8, 1, 'Task "Setup Database Schema" has been marked as Done.', 1),
(9, 3, 'You have been assigned a new task: "Design Figma Mockups".', 0),
(10, 1, 'Reminder: "Review Code Pull Request" is due today at 16:00.', 0),
(11, 3, 'You have been assigned a new task: "Submit Sprint Report".', 1),
(12, 1, 'Task "Buy Household Supplies" was cancelled.', 1);
GO

-- 7. FORWARDED TASKS (5 Records)
INSERT INTO ForwardedTasks (OriginalTaskId, ForwardedBy, ForwardedTo) VALUES
(8, 1, 1),
(9, 3, 3),
(10, 4, 4),
(11, 5, 5),
(12, 6, 6);
GO

-- 8. SNOOZE LOGS (5 Records)
INSERT INTO SnoozeLogs (TaskId, UserId, SnoozedAt, WakeAt) VALUES
(8, 1, GETDATE(), DATEADD(MINUTE, 10, GETDATE())),
(9, 3, GETDATE(), DATEADD(MINUTE, 15, GETDATE())),
(10, 1, GETDATE(), DATEADD(HOUR, 1, GETDATE())),
(11, 5, GETDATE(), DATEADD(MINUTE, 30, GETDATE())),
(12, 4, GETDATE(), DATEADD(HOUR, 2, GETDATE()));
GO


Select * from Users
Select * from UserSettings
Select * from GroupsUser
Select * from GroupMembers
Select * from Tasks
Select * from Notifications
Select * from ForwardedTasks
Select * from SnoozeLogs
