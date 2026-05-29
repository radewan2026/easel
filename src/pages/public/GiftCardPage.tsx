import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePurchaseGiftCard } from '../../hooks/useGiftCards';
import { formatCurrency } from '../../lib/utils';
import { Gift, Check, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import AnimatedText from '../../components/animations/AnimatedText';
import SEO from '../../components/SEO';

const PRESET_AMOUNTS = [25, 50, 75, 100, 150, 200];

export default function GiftCardPage() {
  const navigate = useNavigate();
  const purchaseGiftCard = usePurchaseGiftCard();
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [purchaserName, setPurchaserName] = useState('');
  const [purchaserEmail, setPurchaserEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [giftCode, setGiftCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedAmount = customAmount ? parseFloat(customAmount) : amount;

  const handlePurchase = async () => {
    const newErrors: Record<string, string> = {};
    if (!purchaserName.trim()) newErrors.purchaserName = 'Required';
    if (!purchaserEmail.trim()) newErrors.purchaserEmail = 'Required';
    else if (!/\S+@\S+\.\S+/.test(purchaserEmail)) newErrors.purchaserEmail = 'Invalid email';
    if (customAmount && (parseFloat(customAmount) <= 0 || isNaN(parseFloat(customAmount)))) {
      newErrors.customAmount = 'Enter a valid amount';
    }
    if (recipientEmail && !/\S+@\S+\.\S+/.test(recipientEmail)) newErrors.recipientEmail = 'Invalid email';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      const result = await purchaseGiftCard.mutateAsync({
        amount: selectedAmount,
        purchaser_name: purchaserName,
        purchaser_email: purchaserEmail,
        recipient_name: recipientName || undefined,
        recipient_email: recipientEmail || undefined,
        message: message || undefined,
      });
      setGiftCode(result.code);
      setSubmitted(true);
    } catch {
      setErrors({ submit: 'Failed to purchase gift card. Please try again.' });
    }
  };

  if (submitted) {
    return (
      <div className="py-16">
        <div className="mx-auto max-w-lg px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Gift Card Purchased!</h1>
          <p className="text-gray-600 mb-6">
            Your gift card code is:
          </p>
          <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-6 mb-6">
            <p className="text-3xl font-mono font-bold text-primary-600 tracking-widest">{giftCode}</p>
            <p className="text-sm text-primary-500 mt-2">Worth {formatCurrency(selectedAmount)}</p>
          </div>
          <p className="text-sm text-gray-500 mb-2">
            We've sent the gift card details to <span className="font-medium">{purchaserEmail}</span>.
          </p>
          {recipientEmail && (
            <p className="text-sm text-gray-500">
              A copy has also been sent to <span className="font-medium">{recipientEmail}</span>.
            </p>
          )}
          <div className="mt-8">
            <Button onClick={() => navigate('/')}>Back to Home</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12" style={{ backgroundColor: 'var(--section-bg-white)' }}>
      <SEO title="Gift Cards" description="Give the gift of creativity, wine, and fun! Perfect for birthdays, anniversaries, or just because." />
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center mb-10">
          <Gift className="h-12 w-12 text-primary-500 mx-auto mb-4" />
          <AnimatedText
            text="Gift a Paint & Sip Experience"
            as="h1"
            className="text-3xl font-bold text-gray-900 mb-2"
            animation="slideUp"
            stagger={60}
          />
          <AnimatedText
            text="Give the gift of creativity, wine, and fun! Perfect for birthdays, anniversaries, or just because."
            as="p"
            className="text-gray-600 max-w-lg mx-auto"
            animation="fadeIn"
            stagger={15}
            delay={300}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Choose Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {PRESET_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => { setAmount(a); setCustomAmount(''); }}
                      className={`py-3 rounded-lg font-semibold text-sm border-2 transition-colors ${
                        !customAmount && amount === a
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {formatCurrency(a)}
                    </button>
                  ))}
                </div>
                <Input
                  label="Custom Amount"
                  type="number"
                  min="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter custom amount"
                  error={errors.customAmount}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Your Name *"
                  value={purchaserName}
                  onChange={(e) => setPurchaserName(e.target.value)}
                  error={errors.purchaserName}
                  placeholder="John Doe"
                />
                <Input
                  label="Your Email *"
                  type="email"
                  value={purchaserEmail}
                  onChange={(e) => setPurchaserEmail(e.target.value)}
                  error={errors.purchaserEmail}
                  placeholder="john@example.com"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recipient (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Recipient Name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Jane Smith"
                />
                <Input
                  label="Recipient Email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  error={errors.recipientEmail}
                  placeholder="jane@example.com"
                />
                <Textarea
                  label="Personal Message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Happy Birthday! Enjoy a night of painting and wine..."
                />
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Gift Card Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white text-center">
                  <Gift className="h-8 w-8 mx-auto mb-2 opacity-80" />
                  <p className="text-sm opacity-80">Paint & Sip</p>
                  <p className="text-3xl font-bold">{formatCurrency(selectedAmount)}</p>
                  {recipientName && <p className="text-sm mt-2 opacity-80">For: {recipientName}</p>}
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Amount</span>
                  <span className="font-medium">{formatCurrency(selectedAmount)}</span>
                </div>

                {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePurchase}
                  disabled={purchaseGiftCard.isPending}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {purchaseGiftCard.isPending ? 'Processing...' : `Purchase — ${formatCurrency(selectedAmount)}`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
