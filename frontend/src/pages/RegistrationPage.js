import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import { CalendarBlank, ArrowRight, ArrowLeft, CheckCircle, Eye, EyeSlash, Student, Backpack } from '@phosphor-icons/react';
import axios from 'axios';
import { API_BASE } from '../utils/api';

const RegistrationPage = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    id_number: '', full_name: '', date_of_birth: '', current_class: '', section: '',
    email: '', phone_number: '', is_ex_student: false,
    date_of_leaving: '', last_class: '', current_status: '',
    username: '', password: '', confirm_password: ''
  });

  const [dobDate, setDobDate] = useState(null);
  const [leavingDate, setLeavingDate] = useState(null);
  const [otp, setOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  const sendOTP = async () => {
    if (!validateEmail(formData.email)) { toast.error('Please enter a valid email address (e.g. name@example.com)'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/send-otp`, { email: formData.email });
      toast.success('OTP sent to your email!');
      if (res.data.dev_otp) toast.info(`Dev OTP: ${res.data.dev_otp}`);
    } catch { toast.error('Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/verify-otp`, { email: formData.email, otp });
      toast.success('Email verified!');
      setEmailVerified(true);
    } catch (e) { toast.error(e.response?.data?.detail || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!emailVerified) { toast.error('Please verify your email first'); return; }
    if (!formData.username.trim()) { toast.error('Username is required'); return; }
    if (!formData.password) { toast.error('Password is required'); return; }
    if (formData.password !== formData.confirm_password) {
      toast.error('Passwords do not match'); return;
    }
    if (formData.password && formData.password.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    setLoading(true);
    try {
      // Check username uniqueness
      if (formData.username) {
        const checkRes = await axios.get(`${API_BASE}/auth/check-username/${formData.username}`);
        if (!checkRes.data.available) { toast.error('Username already taken, please choose another'); setLoading(false); return; }
      }
      const payload = { ...formData };
      delete payload.confirm_password;
      if (!payload.password) delete payload.password;
      if (!payload.username) delete payload.username;
      const res = await axios.post(`${API_BASE}/auth/register`, payload);
      navigate('/pending-registration', {
        state: {
          serialNumber: res.data.serial_number,
          regId: res.data.reg_id,
          registration: res.data.registration,
          editableUntil: res.data.editable_until
        }
      });
    } catch (e) { toast.error(e.response?.data?.detail || 'Registration failed'); }
    finally { setLoading(false); }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.id_number.trim() || !formData.full_name.trim() || !formData.date_of_birth) {
        toast.error('Please fill all required fields'); return;
      }
      if (!formData.username.trim()) {
        toast.error('Username is required'); return;
      }
      if (formData.username.length < 3) {
        toast.error('Username must be at least 3 characters'); return;
      }
    }
    if (step === 2) {
      if (!formData.is_ex_student) {
        if (!formData.current_class || !formData.section) {
          toast.error('Please fill all required fields'); return;
        }
        const grade = parseInt(formData.current_class);
        if (grade < 4) { navigate('/too-young'); return; }
      } else {
        if (!formData.date_of_leaving || !formData.last_class || !formData.current_status) {
          toast.error('Please fill all required fields'); return;
        }
      }
    }
    setStep(s => s + 1);
  };

  const classOptions = Array.from({length: 12}, (_, i) => ({ value: String(i+1), label: `Grade ${i+1}` }));
  const sectionOptions = [
    { value: 'B1', label: 'B1 (Boys)' }, { value: 'B2', label: 'B2 (Boys)' },
    { value: 'G1', label: 'G1 (Girls)' }, { value: 'G2', label: 'G2 (Girls)' }
  ];
  const exStudentStatusOptions = [
    { value: 'School', label: '🏫 School' },
    { value: 'College', label: '🎓 College' },
    { value: 'University', label: '📚 University' },
    { value: 'Higher Studies', label: '🔬 Higher Studies' },
    { value: 'Graduated', label: '🎉 Graduated' },
    { value: 'Working', label: '💼 Working' },
    { value: 'Other', label: '✨ Other' },
  ];

  const stepLabels = ['Personal Info', 'School Info', 'Account Setup'];

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black" style={{ color: 'var(--text-1)' }}>Join BISD HUB</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Registration requires admin approval</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6 px-2">
          {stepLabels.map((label, i) => {
            const s = i + 1;
            const active = s === step;
            const done = s < step;
            return (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all ${
                    done ? 'border-green-500 bg-green-500 text-white'
                    : active ? 'border-blue-500 bg-blue-500 text-white'
                    : 'text-muted-foreground bg-muted'
                  }`} style={{ borderColor: done ? '#22c55e' : active ? 'var(--blue)' : 'var(--border-c)' }}>
                    {done ? <CheckCircle size={18} weight="fill" /> : s}
                  </div>
                  <span className="text-[10px] font-semibold hidden sm:block" style={{ color: active ? 'var(--blue)' : 'var(--text-3)' }}>{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2" style={{ background: s < step ? '#22c55e' : 'var(--border-c)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-black mb-4" style={{ color: 'var(--text-1)' }}>Personal Information</h2>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>School ID Number *</Label>
                <Input value={formData.id_number} onChange={e => handleChange('id_number', e.target.value)}
                  className="rounded-xl border-2 font-mono" placeholder="e.g., 1234"
                  style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>This is your permanent school ID. Cannot be changed later.</p>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Full Name *</Label>
                <Input value={formData.full_name} onChange={e => handleChange('full_name', e.target.value)}
                  className="rounded-xl border-2" placeholder="Provide your full real name"
                  style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>Enter your real name. Contact admin to change later.</p>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Date of Birth *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button className="w-full justify-start text-left font-normal rounded-xl border-2"
                      style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: formData.date_of_birth ? 'var(--text-1)' : 'var(--text-3)' }}>
                      <CalendarBlank size={16} className="mr-2" />
                      {formData.date_of_birth || 'Select your date of birth'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dobDate} captionLayout="dropdown-buttons" fromYear={1980} toYear={2015}
                      onSelect={d => { setDobDate(d); handleChange('date_of_birth', formatDate(d)); }} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>
                  Username *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold" style={{ color: 'var(--text-3)' }}>@</span>
                  <Input value={formData.username} onChange={e => handleChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="rounded-xl border-2 pl-8" placeholder="your_username (required)"
                    style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                </div>
              </div>
              <Button onClick={nextStep} className="w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 border-2"
                style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                Next <ArrowRight size={16} weight="bold" />
              </Button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-black mb-4" style={{ color: 'var(--text-1)' }}>School Information</h2>

              {/* Student Type Cards */}
              <div>
                <Label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-2)' }}>I am a... *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => handleChange('is_ex_student', false)}
                    className="p-4 rounded-xl border-2 text-left transition-all"
                    style={{
                      borderColor: !formData.is_ex_student ? 'var(--blue)' : 'var(--border-c)',
                      background: !formData.is_ex_student ? 'rgba(37,99,235,0.08)' : 'var(--bg-surface)',
                    }}>
                    <Backpack size={28} weight="fill" style={{ color: !formData.is_ex_student ? 'var(--blue)' : 'var(--text-3)' }} className="mb-2" />
                    <p className="font-black text-sm" style={{ color: 'var(--text-1)' }}>Current Student</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>Currently studying at BISD</p>
                  </button>
                  <button type="button" onClick={() => handleChange('is_ex_student', true)}
                    className="p-4 rounded-xl border-2 text-left transition-all"
                    style={{
                      borderColor: formData.is_ex_student ? 'var(--blue)' : 'var(--border-c)',
                      background: formData.is_ex_student ? 'rgba(37,99,235,0.08)' : 'var(--bg-surface)',
                    }}>
                    <Student size={28} weight="fill" style={{ color: formData.is_ex_student ? 'var(--blue)' : 'var(--text-3)' }} className="mb-2" />
                    <p className="font-black text-sm" style={{ color: 'var(--text-1)' }}>EX Student</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>Previously studied at BISD</p>
                  </button>
                </div>
              </div>

              {!formData.is_ex_student ? (
                <>
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Current Grade *</Label>
                    <Select value={formData.current_class} onValueChange={v => handleChange('current_class', v)}>
                      <SelectTrigger className="rounded-xl border-2" style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }}>
                        <SelectValue placeholder="Select your grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {classOptions.map(o => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                            {parseInt(o.value) < 4 && <span className="text-xs text-red-400 ml-2">(Not eligible)</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.current_class && parseInt(formData.current_class) < 4 && (
                      <p className="text-xs text-red-500 mt-1 font-semibold">⚠️ BISD HUB is for Grade 4 and above only.</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Section *</Label>
                    <Select value={formData.section} onValueChange={v => handleChange('section', v)}>
                      <SelectTrigger className="rounded-xl border-2" style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }}>
                        <SelectValue placeholder="Select your section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Date of Leaving BISD *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button className="w-full justify-start text-left font-normal rounded-xl border-2"
                          style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: formData.date_of_leaving ? 'var(--text-1)' : 'var(--text-3)' }}>
                          <CalendarBlank size={16} className="mr-2" />
                          {formData.date_of_leaving || 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={leavingDate} captionLayout="dropdown-buttons" fromYear={2000} toYear={2026}
                          onSelect={d => { setLeavingDate(d); handleChange('date_of_leaving', formatDate(d)); }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Last Grade at BISD *</Label>
                      <Select value={formData.last_class} onValueChange={v => handleChange('last_class', v)}>
                        <SelectTrigger className="rounded-xl border-2" style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }}>
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          {classOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Section at BISD</Label>
                      <Select value={formData.section} onValueChange={v => handleChange('section', v)}>
                        <SelectTrigger className="rounded-xl border-2" style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }}>
                          <SelectValue placeholder="Section" />
                        </SelectTrigger>
                        <SelectContent>
                          {sectionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Current Status *</Label>
                    <Select value={formData.current_status} onValueChange={v => handleChange('current_status', v)}>
                      <SelectTrigger className="rounded-xl border-2" style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }}>
                        <SelectValue placeholder="What are you doing now?" />
                      </SelectTrigger>
                      <SelectContent>
                        {exStudentStatusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Current Grade / Level</Label>
                    <Input value={formData.current_class} onChange={e => handleChange('current_class', e.target.value)}
                      className="rounded-xl border-2" placeholder="e.g., Grade 12, Year 1..."
                      style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button onClick={() => setStep(1)} className="flex-1 py-3 font-bold rounded-xl border-2 flex items-center justify-center gap-2"
                  style={{ background: 'transparent', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
                  <ArrowLeft size={16} /> Back
                </Button>
                <Button onClick={nextStep} className="flex-1 py-3 font-bold rounded-xl border-2 flex items-center justify-center gap-2"
                  style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                  Next <ArrowRight size={16} weight="bold" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-black mb-4" style={{ color: 'var(--text-1)' }}>Account Setup</h2>

              {/* Email + OTP */}
              <div>
                <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Email Address *</Label>
                <div className="flex gap-2">
                  <Input type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)}
                    className="rounded-xl border-2 flex-1" placeholder="name@example.com"
                    disabled={emailVerified}
                    style={{ borderColor: formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email) ? '#ef4444' : 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                  {!emailVerified && (
                    <Button onClick={sendOTP} disabled={loading || !formData.email}
                      className="px-4 rounded-xl border-2 font-bold"
                      style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                      Send OTP
                    </Button>
                  )}
                </div>
              </div>
              {formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email) && (
                  <p className="text-xs text-red-500">Invalid email format. Use: name@example.com</p>
                )}
              {!emailVerified && (
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>OTP Code *</Label>
                  <div className="flex gap-2">
                    <Input value={otp} onChange={e => setOtp(e.target.value)}
                      className="rounded-xl border-2 flex-1 tracking-widest font-mono text-center" placeholder="• • • • • •"
                      style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                    <Button onClick={verifyOTP} disabled={loading || !otp}
                      className="px-4 rounded-xl border-2 font-bold"
                      style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                      Verify
                    </Button>
                  </div>
                </div>
              )}
              {emailVerified && (
                <div className="rounded-xl p-3 flex items-center gap-2 border"
                  style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)' }}>
                  <CheckCircle size={18} weight="fill" style={{ color: 'var(--green)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--green)' }}>Email verified successfully</span>
                </div>
              )}

              {/* Password */}
              <div className="pt-2 border-t" style={{ borderColor: 'var(--border-c)' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>
                  Choose a password. You will use this to login after approval.
                </p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Password *</Label>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} value={formData.password}
                        onChange={e => handleChange('password', e.target.value)}
                        className="rounded-xl border-2 pr-10" placeholder="Choose a password (min. 6 characters)"
                        style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                        {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                      <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Confirm Password *</Label>
                      <div className="relative">
                        <Input type={showConfirmPassword ? 'text' : 'password'} value={formData.confirm_password}
                          onChange={e => handleChange('confirm_password', e.target.value)}
                          className="rounded-xl border-2 pr-10" placeholder="Repeat password"
                          style={{
                            borderColor: formData.confirm_password && formData.password !== formData.confirm_password ? '#ef4444' : 'var(--border-c)',
                            background: 'var(--bg-input)', color: 'var(--text-1)'
                          }} />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                          {showConfirmPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {formData.confirm_password && formData.password !== formData.confirm_password && (
                        <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div>
                <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Phone Number (Optional)</Label>
                <Input value={formData.phone_number} onChange={e => handleChange('phone_number', e.target.value)}
                  className="rounded-xl border-2" placeholder="+973 XXXX XXXX"
                  style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setStep(2)} className="flex-1 py-3 font-bold rounded-xl border-2"
                  style={{ background: 'transparent', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
                  <ArrowLeft size={16} /> Back
                </Button>
                <Button onClick={handleSubmit} disabled={loading || !emailVerified}
                  className="flex-1 py-3 font-bold rounded-xl border-2"
                  style={{ background: !emailVerified ? 'var(--bg-surface)' : 'var(--blue)', color: !emailVerified ? 'var(--text-3)' : '#fff', borderColor: !emailVerified ? 'var(--border-c)' : 'var(--blue)' }}>
                  {loading ? 'Submitting...' : 'Submit Registration'}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Already have an account?{' '}
              <Link to="/login" className="font-bold hover:underline" style={{ color: 'var(--blue)' }}>Login here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;
