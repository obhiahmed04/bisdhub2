import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import { CalendarBlank, ArrowRight, ArrowLeft, CheckCircle } from '@phosphor-icons/react';
import axios from 'axios';
import { API_BASE } from '../utils/api';

const RegistrationPage = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    id_number: '', full_name: '', date_of_birth: '', current_class: '', section: '',
    email: '', phone_number: '', is_ex_student: false,
    date_of_leaving: '', last_class: '', current_status: ''
  });

  const [dobDate, setDobDate] = useState(null);
  const [leavingDate, setLeavingDate] = useState(null);
  const [otp, setOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };

  const sendOTP = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/auth/send-otp`, { email: formData.email });
      toast.success('OTP sent to your email!');
      if (response.data.dev_otp) toast.info(`Dev OTP: ${response.data.dev_otp}`);
    } catch (error) { toast.error('Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/verify-otp`, { email: formData.email, otp });
      toast.success('Email verified!');
      setEmailVerified(true);
    } catch (error) { toast.error(error.response?.data?.detail || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!emailVerified) { toast.error('Please verify your email first'); return; }
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/auth/register`, formData);
      navigate('/pending-registration', {
        state: {
          serialNumber: response.data.serial_number,
          regId: response.data.reg_id,
          registration: response.data.registration,
          editableUntil: response.data.editable_until
        }
      });
    } catch (error) { toast.error(error.response?.data?.detail || 'Registration failed'); }
    finally { setLoading(false); }
  };

  const nextStep = () => {
    if (step === 1 && (!formData.id_number || !formData.full_name || !formData.date_of_birth)) {
      toast.error('Please fill all required fields'); return;
    }
    if (step === 2) {
      if (!formData.is_ex_student && (!formData.current_class || !formData.section)) {
        toast.error('Please fill all required fields'); return;
      }
      if (formData.is_ex_student && (!formData.date_of_leaving || !formData.last_class || !formData.current_status)) {
        toast.error('Please fill all required fields'); return;
      }
    }
    setStep(step + 1);
  };

  const classOptions = Array.from({length: 12}, (_, i) => ({ value: String(i+1), label: `Class ${i+1}` }));
  const sectionOptions = [
    { value: 'B1', label: 'B1 (Boys)' }, { value: 'B2', label: 'B2 (Boys)' },
    { value: 'G1', label: 'G1 (Girls)' }, { value: 'G2', label: 'G2 (Girls)' }
  ];
  const exStudentStatusOptions = [
    { value: 'College', label: 'College' }, { value: 'University', label: 'University' },
    { value: 'Higher Studies', label: 'Higher Studies' }, { value: 'Graduated', label: 'Graduated' }
  ];
  const exStudentClassOptions = [
    ...classOptions,
    { value: 'College', label: 'College' }, { value: 'University', label: 'University' },
    { value: 'Higher Studies', label: 'Higher Studies' }, { value: 'Graduated', label: 'Graduated' }
  ];

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1,2,3].map(s => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
            s <= step ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-3)] border-[var(--border)]'
          }`}>{s}</div>
          {s < 3 && <div className={`w-8 h-[2px] ${s < step ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-lg">
        <div className="card p-8" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h1 className="heading text-2xl font-black tracking-tight text-center mb-1" style={{ color: 'var(--text-1)' }}>Join BISD HUB</h1>
          <p className="text-center text-sm mb-6" style={{ color: 'var(--text-2)' }}>Registration requires admin approval</p>
          {stepIndicator}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>ID Number</Label>
                <Input data-testid="register-id-input" value={formData.id_number}
                  onChange={(e) => handleChange('id_number', e.target.value)}
                  className="input-styled" placeholder="e.g., BISD12345" />
              </div>
              <div>
                <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Full Name</Label>
                <Input data-testid="register-name-input" value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  className="input-styled" placeholder="Full name as per records" />
              </div>
              <div>
                <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Date of Birth</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button data-testid="register-dob-trigger"
                      className="w-full justify-start text-left font-normal input-styled border" style={{ background: 'var(--bg-input)', color: formData.date_of_birth ? 'var(--text-1)' : 'var(--text-3)' }}>
                      <CalendarBlank size={16} className="mr-2" />
                      {formData.date_of_birth || 'Select date of birth'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dobDate} captionLayout="dropdown-buttons" fromYear={1980} toYear={2015}
                      onSelect={(date) => { setDobDate(date); handleChange('date_of_birth', formatDate(date)); }} />
                  </PopoverContent>
                </Popover>
              </div>
              <Button data-testid="register-next-step1" onClick={nextStep} className="w-full btn btn-primary py-3 flex items-center justify-center gap-2">
                Next <ArrowRight size={16} weight="bold" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Student Status</Label>
                <Select value={formData.is_ex_student ? 'ex' : 'current'} onValueChange={(val) => handleChange('is_ex_student', val === 'ex')}>
                  <SelectTrigger data-testid="register-student-status" className="input-styled"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Student</SelectItem>
                    <SelectItem value="ex">EX Student</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.is_ex_student ? (
                <>
                  <div>
                    <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Date of Leaving</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button data-testid="register-leaving-date-trigger"
                          className="w-full justify-start text-left font-normal input-styled border" style={{ background: 'var(--bg-input)', color: formData.date_of_leaving ? 'var(--text-1)' : 'var(--text-3)' }}>
                          <CalendarBlank size={16} className="mr-2" />
                          {formData.date_of_leaving || 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={leavingDate} captionLayout="dropdown-buttons" fromYear={2000} toYear={2026}
                          onSelect={(date) => { setLeavingDate(date); handleChange('date_of_leaving', formatDate(date)); }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Last Class in BISD</Label>
                    <Select value={formData.last_class} onValueChange={(val) => handleChange('last_class', val)}>
                      <SelectTrigger data-testid="register-last-class" className="input-styled"><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>{classOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Current Status</Label>
                    <Select value={formData.current_status} onValueChange={(val) => handleChange('current_status', val)}>
                      <SelectTrigger data-testid="register-current-status" className="input-styled"><SelectValue placeholder="Select current status" /></SelectTrigger>
                      <SelectContent>{exStudentStatusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Current Class / Level</Label>
                    <Select value={formData.current_class} onValueChange={(val) => handleChange('current_class', val)}>
                      <SelectTrigger data-testid="register-ex-current-class" className="input-styled"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{exStudentClassOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Section (when at BISD)</Label>
                    <Select value={formData.section} onValueChange={(val) => handleChange('section', val)}>
                      <SelectTrigger data-testid="register-section-select" className="input-styled"><SelectValue placeholder="Select section" /></SelectTrigger>
                      <SelectContent>{sectionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Current Class</Label>
                    <Select value={formData.current_class} onValueChange={(val) => handleChange('current_class', val)}>
                      <SelectTrigger data-testid="register-class-input" className="input-styled"><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>{classOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Section</Label>
                    <Select value={formData.section} onValueChange={(val) => handleChange('section', val)}>
                      <SelectTrigger data-testid="register-section-select" className="input-styled"><SelectValue placeholder="Select section" /></SelectTrigger>
                      <SelectContent>{sectionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <Button onClick={() => setStep(1)} className="flex-1 btn btn-ghost py-3 flex items-center justify-center gap-2">
                  <ArrowLeft size={16} weight="bold" /> Back
                </Button>
                <Button data-testid="register-next-step2" onClick={nextStep} className="flex-1 btn btn-primary py-3 flex items-center justify-center gap-2">
                  Next <ArrowRight size={16} weight="bold" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Email Address</Label>
                <div className="flex gap-2">
                  <Input data-testid="register-email-input" type="email" value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)} className="input-styled flex-1"
                    placeholder="your.email@example.com" disabled={emailVerified} />
                  {!emailVerified && (
                    <Button data-testid="send-otp-button" onClick={sendOTP} disabled={loading || !formData.email}
                      className="btn btn-primary px-4">Send OTP</Button>
                  )}
                </div>
              </div>

              {!emailVerified && (
                <div>
                  <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Enter OTP</Label>
                  <div className="flex gap-2">
                    <Input data-testid="verify-otp-input" value={otp} onChange={(e) => setOtp(e.target.value)}
                      className="input-styled flex-1" placeholder="6-digit OTP" />
                    <Button data-testid="verify-otp-button" onClick={verifyOTP} disabled={loading || !otp}
                      className="btn btn-primary px-4">Verify</Button>
                  </div>
                </div>
              )}

              {emailVerified && (
                <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <CheckCircle size={18} weight="fill" style={{ color: 'var(--green)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--green)' }}>Email verified</span>
                </div>
              )}

              <div>
                <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Phone Number (Optional)</Label>
                <Input data-testid="register-phone-input" value={formData.phone_number}
                  onChange={(e) => handleChange('phone_number', e.target.value)} className="input-styled" placeholder="+1234567890" />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setStep(2)} className="flex-1 btn btn-ghost py-3">Back</Button>
                <Button data-testid="register-submit-button" onClick={handleSubmit} disabled={loading || !emailVerified}
                  className="flex-1 btn btn-primary py-3">{loading ? 'Submitting...' : 'Submit Registration'}</Button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Already have an account? <Link to="/login" className="font-bold hover:underline" style={{ color: 'var(--blue)' }}>Login here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;
