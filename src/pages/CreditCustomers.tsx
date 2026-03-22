import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/hooks/useBusiness";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, ChevronRight, AlertTriangle, DollarSign, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type CreditCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  id_number: string | null;
  credit_limit: number;
  total_outstanding: number;
  is_active: boolean;
  created_at: string;
};

type CreditSale = {
  id: string;
  amount: number;
  amount_paid: number;
  balance: number;
  status: string;
  due_date: string | null;
  created_at: string;
  created_by: string;
  approved_by: string | null;
};

type CreditPayment = {
  id: string;
  amount: number;
  payment_method: string;
  received_by: string;
  created_at: string;
};

export default function CreditCustomers() {
  const { user } = useAuth();
  const { businessId, role, isOwner, isManager } = useBusiness();
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CreditCustomer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomer | null>(null);
  const [creditHistory, setCreditHistory] = useState<CreditSale[]>([]);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSaleId, setPaymentSaleId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [members, setMembers] = useState<Record<string, string>>({});

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formIdNumber, setFormIdNumber] = useState("");
  const [formCreditLimit, setFormCreditLimit] = useState("50");

  useEffect(() => {
    if (user && businessId) {
      loadCustomers();
      loadMembers();
    }
  }, [user, businessId]);

  const loadMembers = async () => {
    const { data } = await supabase
      .from("business_members")
      .select("user_id, full_name")
      .eq("business_id", businessId!);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(m => { map[m.user_id] = m.full_name; });
      setMembers(map);
    }
  };

  const loadCustomers = async () => {
    const columns = isOwner || isManager
      ? "*"
      : "id, full_name, credit_limit, total_outstanding, is_active, created_at, created_by";
    const { data } = await supabase
      .from("credit_customers")
      .select(columns)
      .eq("business_id", businessId!)
      .order("full_name");
    setCustomers((data as CreditCustomer[]) || []);
  };

  const loadCustomerHistory = async (customerId: string) => {
    const { data: sales } = await supabase
      .from("credit_sales")
      .select("*")
      .eq("customer_id", customerId)
      .eq("business_id", businessId!)
      .order("created_at", { ascending: false });
    setCreditHistory((sales as CreditSale[]) || []);

    const saleIds = (sales || []).map(s => s.id);
    if (saleIds.length > 0) {
      const { data: pmts } = await supabase
        .from("credit_payments")
        .select("*")
        .in("credit_sale_id", saleIds)
        .order("created_at", { ascending: false });
      setPayments((pmts as CreditPayment[]) || []);
    } else {
      setPayments([]);
    }
  };

  const openCustomerDetail = async (c: CreditCustomer) => {
    setSelectedCustomer(c);
    await loadCustomerHistory(c.id);
  };

  const saveCustomer = async () => {
    if (!formName.trim() || !businessId || !user) return;
    const payload = {
      full_name: formName.trim(),
      phone: formPhone.trim() || null,
      id_number: formIdNumber.trim() || null,
      credit_limit: Number(formCreditLimit) || 50,
    };

    if (editCustomer) {
      const { error } = await supabase
        .from("credit_customers")
        .update(payload)
        .eq("id", editCustomer.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Customer updated");
    } else {
      const { error } = await supabase.from("credit_customers").insert({
        ...payload,
        business_id: businessId,
        created_by: user.id,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Customer added");
    }
    resetForm();
    loadCustomers();
  };

  const resetForm = () => {
    setAddOpen(false);
    setEditCustomer(null);
    setFormName("");
    setFormPhone("");
    setFormIdNumber("");
    setFormCreditLimit("50");
  };

  const openEdit = (c: CreditCustomer) => {
    setEditCustomer(c);
    setFormName(c.full_name);
    setFormPhone(c.phone || "");
    setFormIdNumber(c.id_number || "");
    setFormCreditLimit(String(c.credit_limit));
    setAddOpen(true);
  };

  const recordPayment = async () => {
    if (!paymentSaleId || !user || !businessId) return;
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }

    const sale = creditHistory.find(s => s.id === paymentSaleId);
    if (!sale) return;
    if (amt > sale.balance) { toast.error("Amount exceeds outstanding balance"); return; }

    const { data, error } = await supabase.rpc("record_credit_payment", {
      p_credit_sale_id: paymentSaleId,
      p_business_id: businessId,
      p_amount: amt,
      p_payment_method: paymentMethod,
      p_received_by: user.id,
    });

    if (error) { toast.error(error.message); return; }

    if (selectedCustomer) {
      const newOutstanding = Math.max(0, selectedCustomer.total_outstanding - amt);
      setSelectedCustomer({ ...selectedCustomer, total_outstanding: newOutstanding });
    }

    toast.success("Payment recorded");
    setPaymentOpen(false);
    setPaymentAmount("");
    setPaymentSaleId(null);
    await loadCustomerHistory(selectedCustomer!.id);
    loadCustomers();
  };

  const filtered = customers.filter(c =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  const canManage = isOwner || isManager;

  // Detail view
  if (selectedCustomer) {
    const runningBalance = creditHistory.reduce((sum, s) => sum + s.balance, 0);
    return (
      <div className="page-container">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setSelectedCustomer(null)} className="p-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{selectedCustomer.full_name}</h1>
            <p className="text-xs text-muted-foreground">{selectedCustomer.phone || "No phone"}</p>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => openEdit(selectedCustomer)}>Edit</Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="glass-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className={`text-lg font-bold tabular-nums ${selectedCustomer.total_outstanding > selectedCustomer.credit_limit ? "text-destructive" : ""}`}>
              ${selectedCustomer.total_outstanding.toFixed(2)}
            </p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Credit Limit</p>
            <p className="text-lg font-bold tabular-nums">${selectedCustomer.credit_limit.toFixed(2)}</p>
          </div>
        </div>

        <h2 className="text-sm font-semibold mb-2">Credit Sales</h2>
        <div className="space-y-2 mb-4">
          {creditHistory.map(cs => (
            <div key={cs.id} className="glass-card p-3">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="text-sm font-medium tabular-nums">${cs.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(cs.created_at), "MMM d, HH:mm")}</p>
                  <p className="text-xs text-muted-foreground">By: {members[cs.created_by] || "Unknown"}</p>
                  {cs.approved_by && <p className="text-xs text-muted-foreground">Approved: {members[cs.approved_by] || "Unknown"}</p>}
                </div>
                <div className="text-right">
                  <Badge variant={cs.status === "paid" ? "default" : cs.status === "partial" ? "secondary" : "destructive"} className="text-[10px]">
                    {cs.status}
                  </Badge>
                  {cs.balance > 0 && (
                    <p className="text-xs font-medium tabular-nums mt-1">Bal: ${cs.balance.toFixed(2)}</p>
                  )}
                </div>
              </div>
              {cs.balance > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 text-xs"
                  onClick={() => {
                    setPaymentSaleId(cs.id);
                    setPaymentAmount("");
                    setPaymentMethod("cash");
                    setPaymentOpen(true);
                  }}
                >
                  <DollarSign className="w-3 h-3 mr-1" /> Record Payment
                </Button>
              )}
            </div>
          ))}
          {creditHistory.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No credit sales</p>}
        </div>

        {payments.length > 0 && (
          <>
            <h2 className="text-sm font-semibold mb-2">Payments Received</h2>
            <div className="space-y-2 mb-4">
              {payments.map(p => (
                <div key={p.id} className="glass-card p-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium tabular-nums text-green-500">+${p.amount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.payment_method.replace("_", " ")} · {format(new Date(p.created_at), "MMM d, HH:mm")}</p>
                    <p className="text-xs text-muted-foreground">Received by: {members[p.received_by] || "Unknown"}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Record Payment Dialog */}
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent className="bg-card border-border max-w-xs">
            <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
                <Input className="input-dark" type="number" step="0.01" placeholder="0.00" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Payment Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={recordPayment}>Confirm Payment</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit customer dialog */}
        <Dialog open={addOpen} onOpenChange={v => { if (!v) resetForm(); }}>
          <DialogContent className="bg-card border-border max-w-xs">
            <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input className="input-dark" placeholder="Full Name *" value={formName} onChange={e => setFormName(e.target.value)} />
              <Input className="input-dark" placeholder="Phone" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
              <Input className="input-dark" placeholder="ID Number" value={formIdNumber} onChange={e => setFormIdNumber(e.target.value)} />
              <Input className="input-dark" type="number" placeholder="Credit Limit" value={formCreditLimit} onChange={e => setFormCreditLimit(e.target.value)} />
              <Button className="w-full" onClick={saveCustomer}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Credit Customers" />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="input-dark pl-9 h-9" placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /></Button>
        )}
      </div>

      <div className="space-y-2">
        {filtered.map(c => (
          <button
            key={c.id}
            onClick={() => openCustomerDetail(c)}
            className="w-full glass-card p-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{c.full_name}</p>
              <p className="text-xs text-muted-foreground">{c.phone || "No phone"}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-medium tabular-nums ${c.total_outstanding > c.credit_limit ? "text-destructive" : ""}`}>
                ${c.total_outstanding.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground">/ ${c.credit_limit.toFixed(2)}</p>
              {c.total_outstanding > c.credit_limit && (
                <AlertTriangle className="w-3 h-3 text-destructive inline-block" />
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No credit customers</p>}
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={addOpen && !editCustomer} onOpenChange={v => { if (!v) resetForm(); }}>
        <DialogContent className="bg-card border-border max-w-xs">
          <DialogHeader><DialogTitle>Add Credit Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input className="input-dark" placeholder="Full Name *" value={formName} onChange={e => setFormName(e.target.value)} />
            <Input className="input-dark" placeholder="Phone" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
            <Input className="input-dark" placeholder="ID Number" value={formIdNumber} onChange={e => setFormIdNumber(e.target.value)} />
            <Input className="input-dark" type="number" placeholder="Credit Limit" value={formCreditLimit} onChange={e => setFormCreditLimit(e.target.value)} />
            <Button className="w-full" onClick={saveCustomer}>Add Customer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
