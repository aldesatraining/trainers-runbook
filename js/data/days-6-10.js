import { LINKS, res, resTbd, sec, block, brk, lunch, checklist } from "./helpers.js";

const support = [res("Pando", "external", LINKS.pando), res("Smart Admin (Securenet)", "external", LINKS.smartAdmin), res("Alula Connect", "external", LINKS.alulaConnect)];

export const day6 = {
  id: "d6",
  title: "Day 6",
  theme: "Technical Support · Panels",
  prep: checklist("d6.prep", [
    "Prepare in-office equipment: Cove Simple, Cove Connect+ touchpads and the Puck, including accessories (transformer, external sirens, etc.)",
    "Program a door sensor, window sensor, motion detection and key fob on each panel",
    "Open presentations: Panels (Canva), Tools – Dealer Portal, Tools – Securenet",
    "Verify support site logins: Pando, SecureNet (Smart Admin), Alula Connect",
    "Have each panel type ready to be set up as if new (for the Installation activity)",
  ]),
  reminders: [
    "Trainees must get hands-on time with each panel. In Basic Usage, have each trainee execute a step.",
    "Installation activity: by the end, each security system should be fully set up (panel, touchpad, sensors, key fob).",
  ],
  close: checklist("d6.close", [
    "Reset the training panels and sensors for the next class, or leave them ready for Sensors tomorrow",
    "Confirm every trainee executed at least one step on a panel",
  ]),
  blocks: [
    block("d6-intro", {
      title: "Panels · Introduction",
      minutes: 5,
      summary: "This session covers the alarm panels offered by Cove, with practical applications on the equipment and backend processes such as reading activity logs and panel status during troubleshooting.",
      objective: "Understand the features of each panel; know basic and advanced usage; communicate about the panels expertly to customers; navigate the dealer portal and assess the customer’s system; discover the similarities and differences of each panel (physical appearance, features, navigation, basic usage including installation).",
      sections: [
        sec("Discussion (5 minutes)", "conduct", ["What is a control panel", ["Describe what is a control panel", "How it works", ["Signal path"]]]),
      ],
      resources: [res("Panels (Canva folder)", "presentation", LINKS.panelsFolder), res("Tools – Dealer Portal", "presentation", LINKS.dealerPortalPres), res("Tools – Securenet", "presentation", LINKS.securenetPres), ...support],
    }),
    block("d6-types", {
      title: "Panel Types",
      minutes: 30,
      sections: [
        sec("Cover for each panel", "content", [
          "Cove Simple", ["Overview", ["Physical components", "Specs", "Features"]],
          "Connect +", ["Overview", ["Physical components", "Specs", "Features"]],
          "Cove Puck", ["Overview", "Physical components", "Specs", "Features"],
        ]),
      ],
      resources: [res("Panels (Canva folder)", "presentation", LINKS.panelsFolder)],
    }),
    brk("d6-break1"),
    block("d6-install", {
      title: "Panel Installation",
      type: "activity",
      minutes: 60,
      summary: "Discussion + activity.",
      sections: [
        sec("Do", "conduct", [
          "Using a video or presentation show the steps on how to setup a control panel (initial setup)",
          "Have each type of panel ready to be set up as if they are new",
          ["Trainees should take a part in the set-up process",
           "At the end of this activity, each security system should already be set up",
           ["Panel", ["Touchpad", "Recommended install locations"], "Sensors", ["Door sensor", "Window sensor", "Motion detector", "Key Fob"]]],
        ]),
        sec("Panel Registration: points to cover", "content", [
          "Finding the panel serial number",
          "Panel configuration",
          "Manually activating the CSID", ["Code 954 (Connect +)"],
          "Getting the panel online", ["Soft Reset", "Cell test"],
        ]),
      ],
      actions: ["Every trainee took part in setting up a panel", "Each security system is fully set up (panel, touchpad, sensors, key fob)"],
    }),
    lunch("d6-lunch"),
    block("d6-usage", {
      title: "Panel Basic Usage",
      type: "activity",
      minutes: 30,
      summary: "Discussion + hands on. Trainees must be able to experience navigating the panel as much as they can; while discussing the points below have each trainee execute a step.",
      sections: [
        sec("Basic navigation", "content", [
          "Going into the settings", "Acknowledging alerts", "User adjustable settings",
          "Panel Status", ["Show the panel LED and status screen", ["open a door or tamper a sensor to demonstrate not ready status, and arm the system"]],
        ]),
        sec("Arming", "content", [
          "Point out the Exit delay and entry delays as arming is being demonstrated.",
          "Arm Away", ["Auto-stay - purposely not open a door sensor to demonstrate"],
          "Arm Stay",
          "Night Mode", ["Emphasize that night mode does not have exit and entry delays"],
        ]),
        sec("Disarming", "content", [
          "Proper disarming", ["Panel Code types", ["Master Code", "Panel Codes", "Duress Code"]],
          "Cancelling false alarms", ["Discuss best practices", "Importance of the verbal password"],
        ]),
        sec("Remote arming/disarming", "content", ["Key fob and App disarming", "Key difference when arming remotely:", ["No Auto-stay"]]),
      ],
      warnings: ["Night mode has NO exit or entry delays. Emphasize this.", "Remote arming has no Auto-stay."],
      actions: ["Each trainee executed a step on the panel"],
    }),
  ],
};

export const day7 = {
  id: "d7",
  title: "Day 7",
  theme: "Technical Support · Sensors · Cove Connect Upgrade",
  prep: checklist("d7.prep", [
    "Prepare sensors ahead: program at least one of each sensor type and install if possible",
    "Have at least two of each sensor type available",
    "Disconnect all sensors from the panel before the Programming and Installation activity",
    "Have sensor installation guides available for trainees",
    "Open the Sensors presentation",
  ]),
  reminders: [
    "Sensors: hands-on is essential. Trainees program and install sensors with the help of the guide and pointers from discussions.",
    "Cove Connect Upgrade: tell the customer an upgrade is permanent and they cannot return to the Simple Panel BEFORE completing the checklist.",
  ],
  close: checklist("d7.close", [
    "Confirm each trainee demonstrated their assigned sensors",
    "Confirm trainees can walk through the Connect upgrade checklist",
  ]),
  blocks: [
    block("d7-sensors-intro", {
      title: "Sensors · Introduction",
      minutes: null,
      summary: "All about the sensors, from their basic functions to installation and troubleshooting. Trainees learn through hands-on activities and theory discussion. Sensors total: 1 hour.",
      objective: "Identify and explain the function of each Cove security sensor; understand sensor specifications and features; explain the programming and installation process of each sensor; troubleshoot and resolve sensor issues. Trainees must have hands-on experience (installation, programming, troubleshooting) and be able to respond to the role-plays.",
      sections: [
        sec("Presentation and demonstration", "conduct", [
          "Show the equipment in person as the sensors are being introduced using a presentation",
          "Take apart sensors when it applies", ["Show internal parts and batteries", "Discuss specs"],
          "Install or if already pre-installed", ["Demonstrate how a sensor is used by customers"],
        ]),
        sec("Sensors to cover", "content", ["Door/window sensors", "Motion detectors", "Glass break detector", "Smoke/H/F Detector", "Carbon Monoxide", "Flood sensor", "Medical button", "Key Fob", "Siren"]),
      ],
      resources: [resTbd("Sensors presentation"), ...support],
    }),
    block("d7-sensors-prog", {
      title: "Sensors · Programming and Installation",
      type: "activity",
      sections: [
        sec("Programming", "conduct", [
          "Hands on is essential. Disconnect all sensors from the panel and have the trainees program and install sensors with the help of the guide and pointers on discussions.",
          "Demonstrate how to program a sensor (any sensor will do)", ["Luna Simple", "Connect+ (cove app)", ["Show: Prerequisites -> Programming -> Installation -> Functionality Check"]],
        ]),
        sec("Installation", "activity", [
          "Have the trainees read through the installation guides for the sensors",
          "Assign sensors to each trainee (at least 2 to 3 sensors each)", ["Practice programming and installation", "Trainees will perform a demonstration for their assigned sensors"],
        ]),
      ],
      actions: ["All sensors disconnected from the panel before starting", "Each trainee has 2–3 assigned sensors", "Each trainee demonstrated their sensors"],
    }),
    brk("d7-break1"),
    block("d7-upgrade", {
      title: "Cove Connect Upgrade",
      minutes: 30,
      summary: "Cove has introduced an updated system, Cove Connect, while some customers remain on the older Cove Simple platform. They should be guided and encouraged to transition. When they request to upgrade, go through the checklist to ensure they qualify and are ready.",
      sections: [
        sec("Before the checklist", "note", ["Inform the customer that once an account is upgraded, it is a permanent procedure, and they cannot return to the Simple Panel."]),
        sec("Cove Connect Upgrade Checklist", "content", [
          "The Account Must be Active", "All Billing Must be Current", "Equipment Balance Resolved", "Upgrade Cost",
          "Sensor Upgrade Cost:", ["If the customer has Smoke/CO combo Detectors they will need to be replaced. Smoke/CO Combo detectors are not compatible with the Cove Connect System. Inform the customer that each replacement Smoke Detector or Carbon Detector will cost $10 each."],
          "Check if the system is online", ["If the system is online, complete a Sync and move to the next step."],
          "Equipment List", ["Sync the system in Pando", ["Equipment", "Click Sync", "Click “New” to add sensors that are there", "Click “Pull” to remove sensors that are not"],
            "NOTE: All TXIDs are 7 digits long. For any serial number that is less than 7 digits keep adding a “0” to the front of the serial number until there are 7 digits in total.",
            "Make a Critical Pando Note of ALL sensors that includes their names and serial numbers/TXIDs."],
          "Order New System", ["Place the order for the new system and include any replacements for Smoke/CO Combo detectors."],
        ]),
        sec("Things the order must include", "content", [
          "Connect+ Hub", "Connect+ Alarm Panel/Touchpad", "Any New Equipment", "Any Replacement Smoke/CO Detectors", ["Any replacement for the Smoke/CO is $10 for the Smoke and $10 for the CO."],
          "Inform the customer that they do not need to send anything back to us and that they can keep their old Gen 1 equipment.",
        ]),
        sec("Activities: Upgrade Process", "activity", [
          "Guide the trainees through the complete upgrade process in a structured, step-by-step manner, explaining the purpose, importance, and expected outcome of every step. Address possible customer concerns, highlight best practices, and reinforce proper communication techniques.",
          "Verify Interactive Provider", "Verify Panel Configuration", "Swap to ConnectPlus", "Register", "Place in Test Mode", "Pull Up the Customer's Alula Account", "Pair the Alarm Panel", "Install Wizard",
        ]),
      ],
      warnings: ["Tell the customer the upgrade is permanent BEFORE running the checklist.", "TXIDs are 7 digits. Pad with leading zeros."],
      resources: [res("Pando", "external", LINKS.pando), res("Alula Connect", "external", LINKS.alula)],
    }),
  ],
};

export const day8 = {
  id: "d8",
  title: "Day 8",
  theme: "Technical Support · Troubleshooting · Apps",
  prep: checklist("d8.prep", [
    "Have the training tablets ready (Samsung tab and iPad) and the test accounts from the Training Department Handbook",
    "Prepare Luna Simple panel troubleshooting scenarios (communication failure, panel swap/registration, power failure, tamper)",
    "Open the Apps presentation",
    "Verify COPS navigation access for the sensor troubleshooting topic",
  ]),
  reminders: [
    "Encourage trainees to use the KB and test accounts during troubleshooting.",
    "Apps: allow 3 min per trainee for self discovery and at least 5 min per trainee for each password reset.",
  ],
  close: checklist("d8.close", [
    "Confirm each trainee performed one of each password reset method",
    "Confirm trainee tablet access and Wi-Fi credentials are ready for Cameras tomorrow",
  ]),
  blocks: [
    block("d8-ts-panel", {
      title: "Panel Troubleshooting",
      minutes: null,
      summary: "Builds the skills to identify, assess, and resolve common panel-related concerns. Troubleshooting total: 1 hour.",
      objective: "Accurately diagnose and assess panel-related concerns using a structured troubleshooting approach; clearly and professionally guide customers through troubleshooting procedures; apply effective solutions efficiently while delivering a positive customer support experience.",
      sections: [
        sec("Identifying issues of the panel(s)", "content", [
          "Accurate issue identification is essential in troubleshooting as it enables efficient resolution, reduces unnecessary steps, and improves the overall customer experience. It also ensures that the appropriate solution is applied while demonstrating professionalism and product knowledge.",
          "Things to consider when identifying issues:", ["Customers statement", "Panel status", "Dealer Sites status", "History/Event Log"],
        ]),
        sec("Discussion + activities: LUNA SIMPLE PANEL", "conduct", [
          "Overview of the most common customer-reported issues and concerns encountered during support interactions.",
          "Communication Failure", ["Diagnoses", "Causes of Panel Communication failure", ["Signal Interference", ["Dense materials like concrete, brick, and metal walls", "Large Electronic Devices – Refrigerators, Air Conditioners, etc.", "Environmental Factors – Severe Weather and natural disasters"], "Service Outages"]],
          "Panel Swap/Panel Registration", ["Prerequisites", "Steps", "Results", ["Successful Panel Swap", "Panel is online", "All Zones/Sensors are programmed and tested", "CX can arm/disarm safely"]],
          "Failed to register the Interactive ID", "Unable to re-add Zones/Sensors", "Power failure", "Tamper",
        ]),
      ],
      resources: support,
    }),
    block("d8-ts-sensor", {
      title: "Sensor Troubleshooting",
      minutes: null,
      objective: "Analyze sensor behavior and determine the root cause of common sensor-related issues; provide clear and confident troubleshooting guidance; restore sensor performance while maintaining service quality and customer satisfaction.",
      summary: "Developing a comprehensive understanding of sensor functionality and the proper methods for diagnosing and resolving common sensor-related concerns.",
      sections: [
        sec("Identifying sensors with trouble conditions", "content", [
          "Identifying which sensor(s) is having an issue is a very crucial part of troubleshooting a security system. It helps you “paint a picture” of the situation that will guide your strategy and decision making.",
          "Ways to identify the sensors:", ["Customers statement", "Panel status", "Dealer Sites status", "History/Event Log"],
        ]),
        sec("Troubleshooting discussion: combined theory discussion and application", "conduct", [
          "The trainer should discuss:",
          ["How to diagnose issues", ["Probing questions", "Trouble messages on the panel", "Understanding event/activity history on the dealer sites"], "Causes of the trouble conditions", "Execution of the troubleshooting steps"],
          "Trainee engagement", ["Encourage the trainees to use the KB", "Use test account whenever possible"],
          "Topics to cover", ["Tamper", "Loss of Supervision (LOS)", "Low battery", "False alarms"],
          "COPS navigation",
        ]),
        sec("Activity: Mock Call", "activity", [
          "Trainees will participate in a simulated customer interaction involving common sensor-related concerns such as tamper conditions, low battery, loss of supervision, or false alarms. The activity allows trainees to practice identifying issues, asking effective probing questions, navigating system tools, and providing clear and professional troubleshooting guidance while the trainer observes and provides feedback on troubleshooting accuracy and customer communication.",
        ]),
      ],
      resources: [res("KB", "knowledge base", LINKS.kb), res("COPS", "external", LINKS.cops), ...support],
      actions: ["Mock call completed. Feedback given on troubleshooting accuracy and communication"],
    }),
    brk("d8-break1"),
    lunch("d8-lunch"),
    block("d8-apps", {
      title: "Cove Apps",
      minutes: null,
      summary: "Trainees deep dive into the Cove apps and explore their features and usage to prepare them to answer customer questions, provide solutions and customer satisfaction.",
      objective: "Identify the different Cove apps and their purposes; download and install the Cove apps on both Android and iOS; navigate the functionalities (logging in, controlling the system, changing app settings); troubleshoot app related issues such as resetting the password.",
      sections: [
        sec("Introduction · Discussion + Demonstration", "conduct", [
          "Use the training tablets to demonstrate the app usage. Project to screen if possible but not necessary.",
          "Guided exploration", ["Lead the trainees in navigating the app as you demonstrate and explain the app pages."],
          "Apps to cover", ["Cove app (SecureNet)", "Cove Connect (Connect+)"],
          "Basic usage", ["Login", ["Default Username and password"], "Navigation", ["Arming/Disarming", "Tabs (connect +)", "App settings", "Notification settings", "Managing accounts"]],
          "Self discovery", ["Give each trainee at least three common tasks", "Allow 3 minutes per trainee to explore the app"],
        ]),
        sec("Installing apps", "conduct", [
          "Show a walk through on downloading apps from both the Google Play Store and the iOS app store.",
          "Highlight:", ["Probing questions prior to providing the steps", "Conveying instructions clearly", "Dealing with customer difficulties"],
          "Execution:", ["Demonstrate by downloading any app from each app store", "show a presentation or cast screen if possible"],
          "Activity: call a random trainee or trainees to provide the steps",
        ]),
        sec("Resetting passwords", "conduct", [
          "A common customer difficulty. Customers might call in to get help with recovering their accounts.",
          "Highlight the different methods in resetting the password:", ["Forgot password option", "Send reset password link (Connect+)", "Resetting via dealer sites"],
          "Execution: perform the different methods and test by logging in",
          "Activity: have the trainees perform one of each reset password method. Allow at least 5 mins for each trainee",
        ]),
      ],
      resources: [resTbd("Apps presentation"), ...support],
      reminders: ["Test account credentials and tablets: see the Training Department Handbook."],
      actions: ["Each trainee completed their self-discovery tasks", "Each trainee performed every password reset method"],
    }),
  ],
};

export const day9 = {
  id: "d9",
  title: "Day 9",
  theme: "Technical Support · Cameras · Cove Consultant",
  prep: checklist("d9.prep", [
    "Prepare all cameras for the training. Two of each if available",
    "Get the Samsung tablet and iPad from the managers pedestal",
    "Get the app credentials and Wi-Fi password from the Training Department Handbook",
    "Open presentations: New Cove Cameras, Cove Cameras",
    "Verify the Cove Portal test account (john.lucino@alder.com) signs in",
    "Verify the public Covesmart website, ID.me, and “Build My System” page load",
  ]),
  reminders: [
    "Cove Consultant: shift from account creation to account management before the Portal walkthrough.",
    "Cameras: trainees pair cameras themselves, then role-play a walkthrough on another trainee or the trainer.",
  ],
  close: checklist("d9.close", [
    "Confirm each trainee paired at least one camera",
    "Confirm trainees completed the sales mock calls",
  ]),
  blocks: [
    block("d9-cam-intro", {
      title: "Cove Cameras · Introduction",
      minutes: null,
      summary: "Cameras are an essential part of a home security system, and arguably one of the reasons customers choose Cove. This training is everything about Cove smart cameras. Cameras total: 1 hour.",
      objective: "Identify and differentiate all Cove smart cameras (current and legacy); master fundamental and advanced features; communicate features and usage clearly; efficiently troubleshoot common issues. Equip trainees to operate the cameras like everyday users and to troubleshoot like a technician.",
      sections: [
        sec("Discussion", "conduct", ["What is a Smart Camera?", ["Definition"]]),
        sec("Cameras to cover", "content", [
          "New Cove Cameras", ["Introduction (Specs and Features)", ["Home Cam V3", "L9/Cove Outdoor Camera", "Cove Doorbell camera"]],
          "Legacy Cameras", ["Eufy Cameras", ["Introduction (Specs and Features)", ["Indoor Cam mini", "S220", "S40 (minor discussion)", "Video Doorbell 2k"]], "Yi indoor", ["Kami wire-free outdoor, Doorbell"], "Skybell Doorbell"],
          "Highlight", ["Storage options", ["Micro SD card", "Cloud storage (legacy)"], "LED indicators"],
        ]),
      ],
      resources: [res("New Cove Cameras (Canva folder)", "presentation", LINKS.newCamerasFolder), res("Cove Cameras (Canva folder)", "presentation", LINKS.camerasFolder)],
    }),
    block("d9-cam-pair", {
      title: "Cameras · Pairing",
      type: "activity",
      sections: [
        sec("Demonstration", "conduct", [
          "Trainer will perform the pairing process first, use any eufy camera",
          "Show a guide or a pairing process presentation as you demonstrate it",
          "(optional) Cast your screen so the trainees can see",
        ]),
        sec("Activity", "activity", [
          "Let the agents go through the pairing process guides for each camera (5 minutes)",
          "Depending on the number of trainees, assign each of them a camera(s) (10–20 minutes)",
          "Role play", ["Have a trainee do a walk through on another trainee or trainer"],
          "Legacy equipment: repeat the demonstration and activity for legacy equipment",
        ]),
      ],
      actions: ["Each trainee paired an assigned camera", "Role play walkthroughs done", "Legacy cameras repeated"],
    }),
    brk("d9-break1"),
    block("d9-cam-ts", {
      title: "Cameras · Troubleshooting",
      sections: [
        sec("Discussion: topics to cover", "content", ["Power issues", "Camera not recording", "Notification Issues", "Battery Drain issue"]),
        sec("Execution", "conduct", ["Discuss the steps, trainee participation is encouraged", "Role-play apply"]),
      ],
    }),
    lunch("d9-lunch"),
    block("d9-consultant", {
      title: "Cove Consultant",
      minutes: null,
      objective: "Assess customer needs and design a customized system; apply website discounts and promotions to secure account creation; process checkout (upfront vs. Affirm); navigate the Cove Portal to educate customers on self-service and troubleshoot login issues.",
      sections: [
        sec("Content", "content", ["Identifying Customer Needs & System Building", "Promos and discounts", "Account Creation Process", "The Cove Customer Portal"]),
        sec("Phase 1: Needs Assessment & System Building", "conduct", [
          "Introduce the Website: Start by sharing your screen and displaying the public Covesmart website. Briefly explain its layout and purpose to the class.",
          "Conduct a Needs Assessment (Mini-Mock Call): Before clicking anything, test the room. Act as a prospective customer and have the agents ask you questions to identify exactly what equipment you need based on their previous product knowledge training.",
          "Navigate to “Build My System”: Once the class has gathered your “needs,” click on the “Build My System” page. Show the agents how the interface looks from the customer's perspective.",
          "Simulate the Build: Live on your screen, select the exact cameras and sensors the class just recommended during the mini-mock call.",
        ]),
        sec("Phase 2: Pricing, Discounts, & Checkout", "conduct", [
          "Apply Site Discounts: Add the built system to the cart. Show the agents how to apply site discounts, emphasizing how showcasing these “huge discounts” helps secure the sale.",
          "Navigate to Checkout: Proceed to the final checkout screen.",
          "Explain Payment Options (Upfront vs. Affirm): Clearly show the two payment pathways. Explicitly explain what Affirm is, how the financing works, and how agents can pitch this to customers who are hesitant about upfront costs.",
        ]),
        sec("Phase 3: Application Activity", "activity", [
          "Execute Sales Mock Calls: Pause the walkthrough.",
          ["Act as the customer to assess the agents' ability to identify customer needs. Provide guidance and assist them if they do not know what the next step is. (This will only cover a part of how they navigate in covesmart website)",
           ["Customer is calling in wanting to know what’s hometown hero", "Customer is calling in wants to know what’s the best camera for his pet outside the house."]],
        ]),
        sec("Phase 4: Special Discounts & Portal Management", "conduct", [
          "Review Hometown Heroes & ID.me: Once the mock calls are done, introduce the Hometown Heroes discount. Pull up the ID.me website on your screen and explain how customers verify their status to get this specific promotion.",
          "Introduce the Cove Portal: Shift the topic from account creation to account management. Educate the trainees on what the Cove Portal is and why it is important for customers to use it.",
          "Walkthrough the Portal Interface: Log into the portal using the test account (john.lucino@alder.com). Give the class a brief visual tour of where customers can manage their billing and verbal passwords.",
          "Demonstrate Portal Troubleshooting: Conclude the module by explicitly showing the agents the step-by-step process for troubleshooting and fixing an account when a customer states they cannot access or log into their portal.",
          ["This includes how to troubleshoot customer cannot access cove portal"],
        ]),
      ],
      reminders: ["Topic description is still blank in the source outline. Sample mock call scenarios are still being requested (at least 2–3)."],
      resources: [res("Cove Portal", "external", LINKS.portal)],
      actions: ["Sales mock calls completed (Hometown Heroes; best camera for a pet outside)", "Portal login troubleshooting demonstrated"],
    }),
  ],
};

export const day10 = {
  id: "d10",
  title: "Day 10",
  theme: "Pre-Nesting · Post-Nesting",
  prep: checklist("d10.prep", [
    "Open presentations: VICI, Workforce Management",
    "Verify trainee VICI Dialer logins work",
  ]),
  reminders: [
    "Pre-Nesting is the transition to the dialer trainees will use daily. Post-Nesting covers call-in procedures for production-floor readiness.",
    "Source comment: VICI should be a separate course with Workforce. The structure here follows the current outline.",
  ],
  close: checklist("d10.close", [
    "Confirm every trainee can log in to VICI and complete a transfer, hold, outbound call, and hang up",
    "Confirm trainees know call-in channels and the sick/vacation leave processes",
    "Complete the training program: hand off trainees to nesting",
  ]),
  blocks: [
    block("d10-vici", {
      title: "VICI Dialer (Pre-Nesting)",
      minutes: null,
      summary: "After gaining essential knowledge and foundational skills for frontline customer interactions, trainees transition to learning the primary dialer system for day-to-day operations: functions, navigation, and key features.",
      objective: "Know the purpose of Vici; log in to Vici; navigate and utilize Vici using the different functions; transfer a call; place a call on hold; do an outbound call; hang up the call.",
      sections: [
        sec("Discussion & Demonstration", "conduct", ["The trainer will conduct a short discussion and a demonstration covering the following topics and how to do it."]),
        sec("VICI Interface", "content", ["Dashboard", ["Inbound Call", "Outbound Call", "Call Transfer", "Common Navigation"]]),
      ],
      resources: [res("VICI", "presentation", LINKS.vici)],
      actions: ["Each trainee logged in and completed transfer, hold, outbound call, hang up"],
    }),
    brk("d10-break1"),
    block("d10-wfm", {
      title: "Workforce Management (Post-Nesting)",
      minutes: null,
      summary: "Equips trainees with a clear understanding of proper call-in procedures for production-floor readiness: reporting absences, tardiness, or unforeseen schedule concerns, and who must be informed.",
      objective: "Demonstrate proper attendance and call-in procedures; identify the appropriate communication channels and escalation procedures; practice workplace accountability and professional responsibility through timely communication.",
      sections: [
        sec("Discussion", "conduct", ["The trainer will conduct a short discussion covering these topics.", ["Proper Call-In procedure", "Call In channels", "Sick leave process", "Vacation Leave Process"]]),
      ],
      resources: [res("Workforce Management", "presentation", LINKS.workforce)],
    }),
  ],
};
