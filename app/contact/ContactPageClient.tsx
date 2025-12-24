"use client"

import { useState } from "react"
import {
    Mail,
    Send,
    MessageSquare,
    User,
    AtSign,
    Loader2,
    CheckCircle,
} from "lucide-react"
import { sendContactEmail } from "@/app/api/actions/contact"

export default function ContactPageClient() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        subject: "",
        message: "",
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitStatus, setSubmitStatus] = useState<{
        type: "success" | "error" | null
        message: string
    }>({ type: null, message: "" })

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setSubmitStatus({ type: null, message: "" })

        const result = await sendContactEmail(formData)

        if (result.success) {
            setSubmitStatus({
                type: "success",
                message:
                    "Your message has been sent! We'll get back to you soon.",
            })
            setFormData({ name: "", email: "", subject: "", message: "" })
        } else {
            setSubmitStatus({
                type: "error",
                message:
                    result.error || "Something went wrong. Please try again.",
            })
        }

        setIsSubmitting(false)
    }

    return (
        <main className='min-h-screen bg-background w-full py-12 px-6'>
            <div className='max-w-3xl w-full mx-auto'>
                {/* Header */}
                <div className='text-center mb-12'>
                    <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4'>
                        <Mail className='w-8 h-8 text-primary' />
                    </div>
                    <h1 className='font-serif text-4xl md:text-5xl font-bold text-text mb-4'>
                        Get in Touch
                    </h1>
                    <p className='text-text/70 text-lg max-w-md mx-auto'>
                        Have a question, suggestion, or just want to say hello?
                        I&apos;d love to hear from you.
                    </p>
                </div>

                {/* Contact Form */}
                <div className='bg-text/5 border border-text/10 rounded-xl p-6 md:p-8'>
                    <form
                        onSubmit={handleSubmit}
                        className='space-y-6'
                    >
                        {/* Name */}
                        <div className='space-y-2'>
                            <label
                                htmlFor='name'
                                className='flex items-center gap-2 text-sm font-medium text-text/80'
                            >
                                <User className='w-4 h-4' />
                                Your Name
                            </label>
                            <input
                                id='name'
                                name='name'
                                type='text'
                                value={formData.name}
                                onChange={handleChange}
                                placeholder='John Doe'
                                required
                                className='w-full px-4 py-3 bg-background border border-text/20 rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors'
                            />
                        </div>

                        {/* Email */}
                        <div className='space-y-2'>
                            <label
                                htmlFor='email'
                                className='flex items-center gap-2 text-sm font-medium text-text/80'
                            >
                                <AtSign className='w-4 h-4' />
                                Email Address
                            </label>
                            <input
                                id='email'
                                name='email'
                                type='email'
                                value={formData.email}
                                onChange={handleChange}
                                placeholder='john@example.com'
                                required
                                className='w-full px-4 py-3 bg-background border border-text/20 rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors'
                            />
                        </div>

                        {/* Subject */}
                        <div className='space-y-2'>
                            <label
                                htmlFor='subject'
                                className='flex items-center gap-2 text-sm font-medium text-text/80'
                            >
                                <MessageSquare className='w-4 h-4' />
                                Subject
                            </label>
                            <input
                                id='subject'
                                name='subject'
                                type='text'
                                value={formData.subject}
                                onChange={handleChange}
                                placeholder='What is this about?'
                                required
                                className='w-full px-4 py-3 bg-background border border-text/20 rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors'
                            />
                        </div>

                        {/* Message */}
                        <div className='space-y-2'>
                            <label
                                htmlFor='message'
                                className='flex items-center gap-2 text-sm font-medium text-text/80'
                            >
                                <Mail className='w-4 h-4' />
                                Your Message
                            </label>
                            <textarea
                                id='message'
                                name='message'
                                value={formData.message}
                                onChange={handleChange}
                                placeholder="Tell us what's on your mind..."
                                required
                                rows={6}
                                className='w-full px-4 py-3 bg-background border border-text/20 rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none'
                            />
                        </div>

                        {/* Status Message */}
                        {submitStatus.type && (
                            <div
                                className={`flex items-center gap-2 p-4 rounded-lg ${
                                    submitStatus.type === "success"
                                        ? "bg-green-100 text-green-800 border border-green-200"
                                        : "bg-red-100 text-red-800 border border-red-200"
                                }`}
                            >
                                {submitStatus.type === "success" && (
                                    <CheckCircle className='w-5 h-5 shrink-0' />
                                )}
                                <p className='text-sm'>
                                    {submitStatus.message}
                                </p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type='submit'
                            disabled={isSubmitting}
                            className='w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary text-tertiary font-semibold rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-colors disabled:opacity-70 disabled:cursor-not-allowed'
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className='w-5 h-5 animate-spin' />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className='w-5 h-5' />
                                    Send Message
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Additional Contact Info */}
                <div className='mt-8 text-center'>
                    <p className='text-text/50 text-sm'>
                        You can also reach me at{" "}
                        <a
                            href='mailto:adrianbonpin@gmail.com'
                            className='text-primary hover:underline'
                        >
                            adrianbonpin@gmail.com
                        </a>
                    </p>
                </div>
            </div>
        </main>
    )
}
