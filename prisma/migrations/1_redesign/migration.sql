-- AlterTable
ALTER TABLE "ServiceRecord" ADD COLUMN "nextServiceAtKm" INTEGER;
ALTER TABLE "ServiceRecord" ADD COLUMN "odometerNotifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "ExpenseCategoryConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'tag',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "dateFormat" TEXT NOT NULL DEFAULT 'system',
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationTime" TEXT NOT NULL DEFAULT '09:00',
    "highPriorityDays" INTEGER NOT NULL DEFAULT 14,
    "odometerReminderKm" INTEGER NOT NULL DEFAULT 500,
    "dismissedAlerts" JSONB NOT NULL DEFAULT '[]',
    "telegramBotToken" TEXT,
    "telegramChatId" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPassword" TEXT,
    "smtpFrom" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppSetting" ("createdAt", "id", "smtpFrom", "smtpHost", "smtpPassword", "smtpPort", "smtpUser", "telegramBotToken", "telegramChatId", "theme", "updatedAt") SELECT "createdAt", "id", "smtpFrom", "smtpHost", "smtpPassword", "smtpPort", "smtpUser", "telegramBotToken", "telegramChatId", "theme", "updatedAt" FROM "AppSetting";
DROP TABLE "AppSetting";
ALTER TABLE "new_AppSetting" RENAME TO "AppSetting";
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "odometerKm" INTEGER,
    "notes" TEXT,
    "categoryConfigId" TEXT,
    "quantity" REAL,
    "unitPrice" DECIMAL,
    "socStart" INTEGER,
    "socEnd" INTEGER,
    "durationMin" INTEGER,
    "station" TEXT,
    "importKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_categoryConfigId_fkey" FOREIGN KEY ("categoryConfigId") REFERENCES "ExpenseCategoryConfig" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "category", "createdAt", "id", "notes", "occurredAt", "odometerKm", "vehicleId") SELECT "amount", "category", "createdAt", "id", "notes", "occurredAt", "odometerKm", "vehicleId" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_categoryConfigId_idx" ON "Expense"("categoryConfigId");
CREATE UNIQUE INDEX "Expense_vehicleId_importKey_key" ON "Expense"("vehicleId", "importKey");
CREATE TABLE "new_Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plateNumber" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vin" TEXT,
    "civSeries" TEXT,
    "registrationSeries" TEXT,
    "engineCapacityCc" INTEGER,
    "powerKw" INTEGER,
    "color" TEXT,
    "totalMassKg" INTEGER,
    "fuelType" TEXT,
    "seats" INTEGER,
    "manufacturingYear" INTEGER,
    "warrantyUntil" DATETIME,
    "acquisitionPrice" DECIMAL,
    "notes" TEXT,
    "imageUrl" TEXT,
    "backgroundImageUrl" TEXT,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "equipment" TEXT,
    "batteryCapacityKwh" REAL,
    "batteryWarrantyUntil" DATETIME,
    "batteryWarrantyKm" INTEGER,
    "driverId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Vehicle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Vehicle" ("acquisitionPrice", "backgroundImageUrl", "civSeries", "color", "createdAt", "createdById", "driverId", "engineCapacityCc", "fuelType", "id", "imageUrl", "make", "manufacturingYear", "model", "notes", "plateNumber", "powerKw", "registrationSeries", "seats", "totalMassKg", "updatedAt", "vin", "warrantyUntil") SELECT "acquisitionPrice", "backgroundImageUrl", "civSeries", "color", "createdAt", "createdById", "driverId", "engineCapacityCc", "fuelType", "id", "imageUrl", "make", "manufacturingYear", "model", "notes", "plateNumber", "powerKw", "registrationSeries", "seats", "totalMassKg", "updatedAt", "vin", "warrantyUntil" FROM "Vehicle";
DROP TABLE "Vehicle";
ALTER TABLE "new_Vehicle" RENAME TO "Vehicle";
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategoryConfig_key_key" ON "ExpenseCategoryConfig"("key");

