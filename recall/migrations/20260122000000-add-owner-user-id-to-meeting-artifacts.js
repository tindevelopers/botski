/**
 * Add ownerUserId to meeting_artifacts (primary owner/organizer of the meeting).
 */
export async function up({ context: { queryInterface } }) {
  const tableDescription = await queryInterface.describeTable("meeting_artifacts");
  const hasColumn = Object.keys(tableDescription).some((k) => k.toLowerCase() === "owneruserid");
  if (hasColumn) return;
  const { Sequelize } = queryInterface.sequelize;
  await queryInterface.addColumn("meeting_artifacts", "ownerUserId", {
    type: Sequelize.UUID,
    allowNull: true,
    references: { model: "users", key: "id" },
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.removeColumn("meeting_artifacts", "ownerUserId");
}
