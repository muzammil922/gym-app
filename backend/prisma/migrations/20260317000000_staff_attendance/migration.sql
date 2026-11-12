-- CreateTable
CREATE TABLE "staff_attendance" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "checkInAt" TIMESTAMPTZ(3),
    "checkOutAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_attendance_gymId_date_idx" ON "staff_attendance"("gymId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_gymId_staffId_date_key" ON "staff_attendance"("gymId", "staffId", "date");

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
