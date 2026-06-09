/**
 * Mock execution for searchPhotos tool.
 */
export async function execute(args) {
  const person = (args.people && args.people.length > 0) ? args.people[0] : "Dad";
  const date = args.fromDate || args.toDate || "2024-03-11";
  
  return [
    {
      id: "photo_001",
      person,
      date,
      url: "mock://photo1"
    }
  ];
}
