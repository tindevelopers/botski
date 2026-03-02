/**
 * Add recording metadata columns to meeting_artifacts (source/archived URLs, format, duration, size).
 */
function hasCol(t, name) {
  return Object.keys(t).some((k) => k.toLowerCase() === name.toLowerCase());
}

export async function up({ context: { queryInterface } }) {
  const { Sequelize } = queryInterface.sequelize;
  const table = await queryInterface.describeTable("meeting_artifacts");

  if (!hasCol(table, "sourceRecordingUrl")) {
    await queryInterface.addColumn("meeting_artifacts", "sourceRecordingUrl", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  }
  if (!hasCol(table, "sourceRecordingExpiry")) {
    await queryInterface.addColumn("meeting_artifacts", "sourceRecordingExpiry", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  }
  if (!hasCol(table, "archivedRecordingUrl")) {
    await queryInterface.addColumn("meeting_artifacts", "archivedRecordingUrl", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  }
  if (!hasCol(table, "archivedAt")) {
    await queryInterface.addColumn("meeting_artifacts", "archivedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  }
  if (!hasCol(table, "recordingFormat")) {
    await queryInterface.addColumn("meeting_artifacts", "recordingFormat", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
  if (!hasCol(table, "recordingDuration")) {
    await queryInterface.addColumn("meeting_artifacts", "recordingDuration", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  }
  if (!hasCol(table, "recordingSize")) {
    await queryInterface.addColumn("meeting_artifacts", "recordingSize", {
      type: Sequelize.BIGINT,
      allowNull: true,
    });
  }
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.removeColumn("meeting_artifacts", "sourceRecordingUrl");
  await queryInterface.removeColumn("meeting_artifacts", "sourceRecordingExpiry");
  await queryInterface.removeColumn("meeting_artifacts", "archivedRecordingUrl");
  await queryInterface.removeColumn("meeting_artifacts", "archivedAt");
  await queryInterface.removeColumn("meeting_artifacts", "recordingFormat");
  await queryInterface.removeColumn("meeting_artifacts", "recordingDuration");
  await queryInterface.removeColumn("meeting_artifacts", "recordingSize");
}
