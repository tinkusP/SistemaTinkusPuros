type CardProps = {
  title: string
  desc: string
}

export default function Card({ title, desc }: CardProps) {
  return (
    <div className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition">
      <h3 className="font-semibold text-gray-800">
        {title}
      </h3>

      <p className="text-gray-400 mt-2 text-sm">
        {desc}
      </p>
    </div>
  )
}