export type WhopSandboxUser = {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  profile_picture: string | null;
  created_at: string;
};

export type WhopSandboxCompany = {
  id: string;
  name: string;
  created_at: string;
};

export type WhopSandboxExperience = {
  id: string;
  name: string;
  company: { id: string; name: string };
  created_at: string;
};

export type WhopSandboxProduct = {
  id: string;
  company_id: string;
  title: string;
  route: string;
  member_count: number;
  price: number;
  created_at: string;
};

export type WhopSandboxMember = {
  id: string;
  company_id: string;
  product_id: string;
  status: 'joined' | 'left';
  joined_at: string | null;
  most_recent_action: string | null;
  most_recent_action_at: string | null;
  user: WhopSandboxUser;
};

export type WhopSandboxPayment = {
  id: string;
  company_id: string;
  created_at: string;
  paid_at: string | null;
  status: 'paid' | 'refunded';
  substatus: string | null;
  currency: 'usd' | 'eur' | 'gbp';
  total: number;
  amount_after_fees: number;
  refunded_amount: number;
  product: { id: string; title: string };
  user: { id: string; username: string; email: string | null; name: string | null };
};


