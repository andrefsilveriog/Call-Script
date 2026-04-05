export const defaultWorkspace = {
  schema_version: 1,
  workspace: {
    groups: [
      { id: 'inbound', name: 'Inbound' },
      { id: 'outbound', name: 'Outbound' },
    ],
    call_types: [
      {
        id: 'inbound_new_inquiry',
        group_id: 'inbound',
        name: 'New Inquiry',
        description: 'Clean rebuilt flow using only block-based rendering.',
        steps: [
          {
            id: 's01',
            sidebar_label: 'Open',
            title: 'Opening',
            script_blocks: [
              { type: 'text', text: 'Hi, this is {{rep_name}} with Joy of Cleaning — how can I help you today?' },
              { type: 'text', text: 'Absolutely. I’ll ask a few quick questions so I can point you in the right direction and give you an accurate estimate.' },
            ],
          },
          {
            id: 's02',
            sidebar_label: 'Info',
            title: 'Contact Info',
            script_blocks: [
              { type: 'text', text: 'Can I get your first and last name?' },
              { type: 'field', field: 'client_name', input: 'text', label: 'Full name', placeholder: 'John Smith' },
              { type: 'text', text: 'What’s the best email to send everything to?' },
              { type: 'field', field: 'client_email', input: 'email', label: 'Email', placeholder: 'john@example.com' },
              { type: 'text', text: 'And is this the best number to reach you?' },
              { type: 'field', field: 'client_phone', input: 'phone', label: 'Phone', placeholder: '(555) 555-5555' },
              { type: 'text', text: 'When were you hoping to have the cleaning done?' },
              { type: 'field', field: 'need_by', input: 'text', label: 'Need by', placeholder: 'ASAP / next week / specific date' },
              { type: 'dynamic_text', text: 'Perfect, {{client_first_name}} — I’ve got {{client_email}} and {{client_phone}}.', show_when_any: ['client_name', 'client_email', 'client_phone'] },
            ],
          },
          {
            id: 's03',
            sidebar_label: 'Intent',
            title: 'One-Time or Recurring',
            script_blocks: [
              { type: 'text', text: 'Before I size this out, are you looking for a one-time cleaning, or are you hoping for ongoing recurring service?' },
              { type: 'field', field: 'service_intent', input: 'select', label: 'Service intent', options: [
                { value: 'one_time', label: 'One-time' },
                { value: 'recurring', label: 'Recurring' },
              ] },
              { type: 'dynamic_text', text: 'Got it — one-time. I’ll figure out whether this is more like a deep / initial clean, move-in / move-out, post-construction, or a lighter custom one-time.', show_when_equals: { field: 'service_intent', value: 'one_time' } },
              { type: 'dynamic_text', text: 'Perfect — recurring. I’ll figure out whether the home is already in maintenance shape or whether it needs that first deeper reset.', show_when_equals: { field: 'service_intent', value: 'recurring' } },
            ],
          },
          {
            id: 's04',
            sidebar_label: 'Path',
            title: 'Property + Path',
            script_blocks: [
              { type: 'text', text: 'What’s the property address?' },
              { type: 'field', field: 'client_address', input: 'address', label: 'Property address', placeholder: '833 Marco Dr NE, St Petersburg, FL 33702' },
              { type: 'action_row', actions: [
                { action: 'lookup_zillow', label: 'Lookup Zillow' },
                { action: 'open_quote_tool', label: 'Open calculator' },
              ] },
              { type: 'dynamic_text', text: 'I’m seeing about {{sqft}} square feet, {{beds}} bedrooms, and {{baths}} bathrooms — does that sound right?', show_when_any: ['sqft', 'beds', 'baths'] },
              { type: 'text', text: 'On a scale from 1 to 10, where 1 means almost perfect and 10 means very, very dirty, how would you rate the home right now?' },
              { type: 'field', field: 'dirt_level', input: 'select', label: 'Dirt level', options: [
                { value: '1', label: '1' },{ value: '2', label: '2' },{ value: '3', label: '3' },{ value: '4', label: '4' },{ value: '5', label: '5' },
                { value: '6', label: '6' },{ value: '7', label: '7' },{ value: '8', label: '8' },{ value: '9', label: '9' },{ value: '10', label: '10' },
              ] },
              { type: 'text', text: 'Just so I route this correctly, is this shaping up more like a deep / initial clean, move-in / move-out, post-construction, true maintenance, or a lighter custom one-time?' },
              { type: 'field', field: 'cleaning_path', input: 'select', label: 'Cleaning type', options: [
                { value: 'deep_initial', label: 'Deep / Initial' },
                { value: 'move_in_out', label: 'Move In / Out' },
                { value: 'post_construction', label: 'Post-Construction' },
                { value: 'maintenance', label: 'Regular / Maintenance' },
                { value: 'custom_one_time', label: 'Lighter Custom One-Time' },
              ] },
            ],
          },
          {
            id: 's05',
            sidebar_label: 'Scope',
            title: 'Scope + Checklist',
            script_blocks: [
              { type: 'dynamic_text', text: 'For a deep / initial cleaning, the goal is a full reset. Things like fridge, oven, cabinets, and windows are add-ons.', show_when_equals: { field: 'cleaning_path', value: 'deep_initial' } },
              { type: 'dynamic_text', text: 'For move-in / move-out, the goal is getting the place ready. It is more vacancy-oriented and detail-heavy than a regular clean.', show_when_equals: { field: 'cleaning_path', value: 'move_in_out' } },
              { type: 'dynamic_text', text: 'For post-construction, the scope is closer to a dust-and-debris reset after work has been done.', show_when_equals: { field: 'cleaning_path', value: 'post_construction' } },
              { type: 'dynamic_text', text: 'For regular maintenance, the scope is lighter and more upkeep-oriented.', show_when_equals: { field: 'cleaning_path', value: 'maintenance' } },
              { type: 'dynamic_text', text: 'For a lighter custom one-time, we can focus on priority areas first.', show_when_equals: { field: 'cleaning_path', value: 'custom_one_time' } },
            ],
          },
          {
            id: 's06',
            sidebar_label: 'Why',
            title: 'Why Now',
            script_blocks: [
              { type: 'text', text: 'What made you decide to get a cleaning now?' },
              { type: 'field', field: 'pain_point', input: 'text', label: 'Why now / pain point', placeholder: 'Overwhelmed, move, guests coming, no time...' },
              { type: 'dynamic_text', text: 'Got it — so the big thing for you is {{pain_point}}.', show_when_any: ['pain_point'] },
            ],
          },
          {
            id: 's07',
            sidebar_label: 'Value',
            title: 'Value',
            script_blocks: [
              { type: 'text', text: 'Based on what you told me, what I’d recommend is the right service path for the home.' },
              { type: 'text', text: 'Every cleaning we do includes a background-checked, trained team, all supplies included, and a fully insured and bonded company.' },
            ],
          },
          {
            id: 's08',
            sidebar_label: 'Price',
            title: 'Price',
            script_blocks: [
              { type: 'dynamic_text', text: 'Based on the home, the condition, and the scope we discussed, for a full {{service_type}} you’re looking at {{one_time_price}}.', show_when_any: ['service_type', 'one_time_price'] },
              { type: 'dynamic_text', text: 'If you wanted recurring service after that, weekly would be around {{weekly_price}}, biweekly around {{biweekly_price}}, and monthly around {{monthly_price}}.', show_when_any: ['weekly_price', 'biweekly_price', 'monthly_price'] },
              { type: 'action_row', actions: [
                { action: 'open_quote_tool', label: 'Open calculator' },
                { action: 'apply_quote_to_call', label: 'Apply latest quote' },
              ] },
            ],
          },
          {
            id: 's09',
            sidebar_label: 'Close',
            title: 'Close',
            script_blocks: [
              { type: 'text', text: 'Right now I have availability on [Day 1] or [Day 2]. Which one works better for you?' },
            ],
          },
          {
            id: 's10',
            sidebar_label: 'Schedule',
            title: 'Schedule',
            script_blocks: [
              { type: 'text', text: 'I have [Day] at [Time], or [Day] [morning / afternoon] — which works better for you?' },
              { type: 'field', field: 'schedule_slot', input: 'text', label: 'Chosen slot', placeholder: 'Wednesday 1:00 PM' },
              { type: 'dynamic_text', text: 'Perfect — I’ve got you penciled in for {{schedule_slot}}.', show_when_any: ['schedule_slot'] },
            ],
          },
          {
            id: 's11',
            sidebar_label: 'Deposit',
            title: 'Deposit',
            script_blocks: [
              { type: 'dynamic_text', text: 'Perfect — I’ve got you for {{schedule_slot}} for the {{service_type}}.', show_when_any: ['schedule_slot', 'service_type'] },
              { type: 'text', text: 'To actually lock that in, we take a 30% deposit right away.' },
              { type: 'dynamic_text', text: 'For move-in / out and post-construction cleanings, the deposit is 50%.', show_when_equals: { field: 'cleaning_path', value: 'move_in_out' } },
              { type: 'dynamic_text', text: 'For move-in / out and post-construction cleanings, the deposit is 50%.', show_when_equals: { field: 'cleaning_path', value: 'post_construction' } },
            ],
          },
          {
            id: 's12',
            sidebar_label: 'Setup',
            title: 'Setup',
            script_blocks: [
              { type: 'text', text: 'How should we handle parking and access?' },
              { type: 'field', field: 'access_notes', input: 'text', label: 'Parking / access', placeholder: 'Driveway, lockbox, gate code...' },
              { type: 'text', text: 'Anything important about trash, flooring, pets, focus areas, or add-ons?' },
              { type: 'field', field: 'setup_notes', input: 'text', label: 'Setup notes', placeholder: 'Two dogs, focus on kitchen, add fridge...' },
            ],
          },
        ],
      },
    ],
  },
};
